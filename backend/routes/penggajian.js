const router = require('express').Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payroll_settings LIMIT 1');
    if (!r.rows.length) {
      await pool.query('INSERT INTO payroll_settings (gaji_pokok, overtime_rate, nama) VALUES (0, 0, \'\')');
      return res.json({ gajiPokok: 0, overtimeRate: 0, nama: '' });
    }
    const s = r.rows[0];
    res.json({
      gajiPokok: Number(s.gaji_pokok),
      overtimeRate: Number(s.overtime_rate),
      nama: s.nama || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const { gajiPokok = 0, overtimeRate = 0, nama = '' } = req.body;
    const r = await pool.query('SELECT id FROM payroll_settings LIMIT 1');
    if (!r.rows.length) {
      await pool.query(
        'INSERT INTO payroll_settings (gaji_pokok, overtime_rate, nama) VALUES ($1, $2, $3)',
        [gajiPokok, overtimeRate, nama]
      );
    } else {
      await pool.query(
        'UPDATE payroll_settings SET gaji_pokok=$1, overtime_rate=$2, nama=$3, updated_at=NOW() WHERE id=$4',
        [gajiPokok, overtimeRate, nama, r.rows[0].id]
      );
    }
    res.json({ gajiPokok: Number(gajiPokok), overtimeRate: Number(overtimeRate), nama });
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

router.get('/closed', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payroll_closed_months ORDER BY tahun DESC, bulan DESC');
    res.json(r.rows.map(c => ({
      id: c.id,
      bulan: c.bulan,
      tahun: c.tahun,
      closedAt: c.closed_at,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/close', requireAuth, async (req, res) => {
  try {
    const { bulan, tahun } = req.body;
    if (!bulan || !tahun) return res.status(400).json({ error: 'bulan dan tahun wajib diisi' });
    await pool.query(
      'INSERT INTO payroll_closed_months (bulan, tahun) VALUES ($1, $2) ON CONFLICT (bulan, tahun) DO NOTHING',
      [bulan, tahun]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/close/:bulan/:tahun', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM payroll_closed_months WHERE bulan=$1 AND tahun=$2', [req.params.bulan, req.params.tahun]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
