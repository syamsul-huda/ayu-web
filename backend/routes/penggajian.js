const router = require('express').Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payroll_settings LIMIT 1');
    if (!r.rows.length) {
      await pool.query('INSERT INTO payroll_settings (gaji_pokok, overtime_rate) VALUES (0, 0)');
      return res.json({ gajiPokok: 0, overtimeRate: 0 });
    }
    const s = r.rows[0];
    res.json({ gajiPokok: Number(s.gaji_pokok), overtimeRate: Number(s.overtime_rate) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const { gajiPokok = 0, overtimeRate = 0 } = req.body;
    const r = await pool.query('SELECT id FROM payroll_settings LIMIT 1');
    if (!r.rows.length) {
      await pool.query('INSERT INTO payroll_settings (gaji_pokok, overtime_rate) VALUES ($1, $2)', [gajiPokok, overtimeRate]);
    } else {
      await pool.query('UPDATE payroll_settings SET gaji_pokok=$1, overtime_rate=$2, updated_at=NOW() WHERE id=$3', [gajiPokok, overtimeRate, r.rows[0].id]);
    }
    res.json({ gajiPokok: Number(gajiPokok), overtimeRate: Number(overtimeRate) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/overtime', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payroll_overtime ORDER BY tgl DESC, created_at DESC');
    res.json(r.rows.map(o => ({
      id: o.id,
      tgl: o.tgl.toISOString().split('T')[0],
      jam: parseFloat(o.jam),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/overtime', requireAuth, async (req, res) => {
  try {
    const { tgl, jam } = req.body;
    if (!tgl || jam === undefined) return res.status(400).json({ error: 'tgl dan jam wajib diisi' });
    const r = await pool.query(
      'INSERT INTO payroll_overtime (tgl, jam) VALUES ($1, $2) RETURNING *',
      [tgl, jam]
    );
    const o = r.rows[0];
    res.json({ id: o.id, tgl: o.tgl.toISOString().split('T')[0], jam: parseFloat(o.jam) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/overtime/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM payroll_overtime WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/additional', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payroll_additional ORDER BY tahun DESC, bulan DESC, created_at DESC');
    res.json(r.rows.map(a => ({
      id: a.id,
      bulan: a.bulan,
      tahun: a.tahun,
      deskripsi: a.deskripsi || '',
      nominal: Number(a.nominal),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/additional', requireAuth, async (req, res) => {
  try {
    const { bulan, tahun, deskripsi = '', nominal = 0 } = req.body;
    if (!bulan || !tahun) return res.status(400).json({ error: 'bulan dan tahun wajib diisi' });
    const r = await pool.query(
      'INSERT INTO payroll_additional (bulan, tahun, deskripsi, nominal) VALUES ($1, $2, $3, $4) RETURNING *',
      [bulan, tahun, deskripsi, nominal]
    );
    const a = r.rows[0];
    res.json({ id: a.id, bulan: a.bulan, tahun: a.tahun, deskripsi: a.deskripsi || '', nominal: Number(a.nominal) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/additional/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM payroll_additional WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
