const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password diperlukan' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Semua field diperlukan' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Password saat ini tidak sesuai' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Password baru harus berbeda dari password lama' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    res.json({ message: 'Password berhasil diubah' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/send-reset', async (req, res) => {
  if (!process.env.ADMIN_EMAIL) return res.status(500).json({ error: 'Konfigurasi ADMIN_EMAIL belum diatur di server.' });
  try {
    const result = await pool.query('SELECT id, username FROM users LIMIT 1');
    if (!result.rows.length) return res.status(404).json({ error: 'Tidak ada akun admin.' });
    const user = result.rows[0];

    // Generate temporary password & reset token
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const tempHash = await bcrypt.hash(tempPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [tempHash, user.id]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await pool.query('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [user.id, token, expiresAt]);

    const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}?reset=${token}`;
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"Ayu Fitriah Web" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: 'Informasi Akun – Ayu Fitriah Personal Web',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:28px">
          <h2 style="color:#00695c;margin-bottom:4px">Informasi Akun Admin</h2>
          <p style="color:#666;margin-top:0">Ayu Fitriah Personal Web</p>
          <div style="background:#f0faf8;border:1px solid #a8dad6;border-radius:12px;padding:20px;margin:20px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:8px 0;color:#5a9a8e;font-size:.85rem;font-weight:600;width:120px">Username</td>
                <td style="padding:8px 0;font-size:1rem;font-weight:700;color:#00695c">: ${user.username}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#5a9a8e;font-size:.85rem;font-weight:600">Password</td>
                <td style="padding:8px 0;font-size:1rem;font-weight:700;color:#00695c;letter-spacing:1px">: ${tempPassword}</td>
              </tr>
            </table>
          </div>
          <p style="color:#666;font-size:.88rem">Gunakan kredensial di atas untuk login. Password ini bersifat sementara.</p>
          <hr style="border:none;border-top:1px solid #e0f5f2;margin:20px 0"/>
          <p style="color:#888;font-size:.85rem;margin-bottom:12px">Ingin mengatur password sendiri? Klik tombol di bawah (berlaku <strong>1 jam</strong>):</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#00695c,#00897b);
                    color:#fff;padding:11px 26px;border-radius:20px;text-decoration:none;
                    font-weight:700;font-size:.9rem">
            &#128273; Atur Password Baru
          </a>
          <p style="color:#ccc;font-size:.72rem;margin-top:20px;word-break:break-all">Link: ${resetUrl}</p>
        </div>`,
    });

    res.json({ message: 'Informasi akun telah dikirim ke email admin.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengirim email. Periksa konfigurasi SMTP.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username diperlukan' });
  if (!process.env.ADMIN_EMAIL) return res.status(500).json({ error: 'Konfigurasi ADMIN_EMAIL belum diatur di server.' });

  try {
    const result = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
    if (!result.rows.length) {
      return res.json({ message: 'Jika username valid, link reset telah dikirim ke email admin.' });
    }
    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}?reset=${token}`;
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"Ayu Fitriah Web" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: 'Reset Password – Ayu Fitriah Personal Web',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#00695c;margin-bottom:8px">Reset Password</h2>
          <p>Ada permintaan reset password untuk akun <strong>${user.username}</strong>.</p>
          <p>Klik tombol di bawah untuk membuat password baru. Link berlaku <strong>1 jam</strong>.</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#00695c,#00897b);
                    color:#fff;padding:12px 28px;border-radius:20px;text-decoration:none;
                    font-weight:700;margin:20px 0;font-size:.95rem">
            &#128273; Reset Password
          </a>
          <p style="color:#999;font-size:.82rem">Jika Anda tidak meminta ini, abaikan email ini.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#bbb;font-size:.75rem;word-break:break-all">Link: ${resetUrl}</p>
        </div>`,
    });

    res.json({ message: 'Link reset password telah dikirim ke email admin.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengirim email. Periksa konfigurasi SMTP di server.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token dan password diperlukan' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

  try {
    const result = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()', [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Link tidak valid atau sudah kadaluarsa.' });

    const { user_id } = result.rows[0];
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user_id]);
    await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

    res.json({ message: 'Password berhasil direset. Silakan login.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
