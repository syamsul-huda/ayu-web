require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./db');

const app = express();

// Trust reverse proxy (NAS/nginx) untuk IP yang akurat
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
      baseUri:    ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiter umum untuk semua /api
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan, coba lagi dalam 15 menit.' },
});
app.use('/api', apiLimiter);

// Body size limit — cegah payload bomb
app.use(express.json({ limit: '2mb' }));

app.use(express.static(path.join(__dirname, 'public')));

// Cache control untuk uploads (bukan kode)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/artikels', require('./routes/artikels'));
app.use('/api/portos', require('./routes/portos'));
app.use('/api/upload', require('./routes/upload'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function initDb() {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (!existing.rows.length) {
    const hash = await bcrypt.hash('astra2025', 10);
    await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('Admin default dibuat: admin / astra2025');
  }
}

const PORT = process.env.PORT || 3001;
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Ayu backend berjalan di port ${PORT}`));
    // Hapus reset token kadaluarsa setiap jam
    setInterval(async () => {
      try {
        await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
      } catch (err) {
        console.error('Token cleanup error:', err.message);
      }
    }, 60 * 60 * 1000);
  })
  .catch(err => {
    console.error('Gagal inisialisasi database:', err.message);
    process.exit(1);
  });
