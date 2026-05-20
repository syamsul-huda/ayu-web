const router = require('express').Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');

function mapPorto(p) {
  return {
    id: p.id,
    title: p.title || '',
    category: p.category || '',
    year: p.year || '',
    client: p.client || '',
    role: p.role || '',
    url: p.url || '',
    description: p.description || '',
    technologies: p.technologies || '',
    cover: p.cover || null,
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM portos ORDER BY created_at DESC');
    res.json(result.rows.map(mapPorto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, category, year, client, role, url, description, technologies, cover } = req.body;
    const result = await pool.query(
      'INSERT INTO portos (title, category, year, client, role, url, description, technologies, cover) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [title, category, year, client, role, url, description, technologies, cover || null]
    );
    res.status(201).json(mapPorto(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, category, year, client, role, url, description, technologies, cover } = req.body;
    const result = await pool.query(
      'UPDATE portos SET title=$1, category=$2, year=$3, client=$4, role=$5, url=$6, description=$7, technologies=$8, cover=$9, updated_at=NOW() WHERE id=$10 RETURNING *',
      [title, category, year, client, role, url, description, technologies, cover || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Portofolio tidak ditemukan' });
    res.json(mapPorto(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM portos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Portofolio tidak ditemukan' });
    res.json({ message: 'Portofolio berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
