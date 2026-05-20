require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));
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
  })
  .catch(err => {
    console.error('Gagal inisialisasi database:', err.message);
    process.exit(1);
  });
