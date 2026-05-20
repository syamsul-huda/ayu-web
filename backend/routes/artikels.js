const router = require('express').Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');

function mapArtikel(a) {
  return {
    id: a.id,
    title: a.title || '',
    category: a.category || '',
    author: a.author || '',
    date: a.date ? a.date.toISOString().split('T')[0] : '',
    content: a.content || '',
    tags: a.tags || '',
    cover: a.cover || null,
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM artikels ORDER BY created_at DESC');
    res.json(result.rows.map(mapArtikel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, category, author, date, content, tags, cover } = req.body;
    const result = await pool.query(
      'INSERT INTO artikels (title, category, author, date, content, tags, cover) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [title, category, author, date || null, content, tags, cover || null]
    );
    res.status(201).json(mapArtikel(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, category, author, date, content, tags, cover } = req.body;
    const result = await pool.query(
      'UPDATE artikels SET title=$1, category=$2, author=$3, date=$4, content=$5, tags=$6, cover=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [title, category, author, date || null, content, tags, cover || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    res.json(mapArtikel(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM artikels WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    res.json({ message: 'Artikel berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
