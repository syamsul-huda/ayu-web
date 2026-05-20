const router = require('express').Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');

function mapProfile(p) {
  return {
    id: p.id,
    npk: p.npk || '',
    name: p.name || '',
    dob: p.dob ? p.dob.toISOString().split('T')[0] : '',
    jobTitle: p.job_title || '',
    company: p.company || '',
    grade: p.grade || '',
    hav: p.hav || '',
    promotionDate: p.promotion_date ? p.promotion_date.toISOString().split('T')[0] : '',
    pa2023: p.pa_2023 || '',
    pa2024: p.pa_2024 || '',
    pa2025: p.pa_2025 || '',
    strength: p.strength || '',
    afd: p.afd || '',
    photo: p.photo || null,
  };
}

function mapIdp(r) {
  return {
    devArea: r.dev_area || '',
    devProgram: r.dev_program || '',
    devTarget: r.dev_target || '',
    dueDate: r.due_date ? r.due_date.toISOString().split('T')[0] : '',
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, npk, name, dob, job_title, company, grade, hav, photo FROM profiles ORDER BY created_at DESC'
    );
    res.json(result.rows.map(mapProfile));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const profileRes = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    if (!profileRes.rows.length) return res.status(404).json({ error: 'Profil tidak ditemukan' });

    const p = profileRes.rows[0];
    const [edu, training, others, work, idp] = await Promise.all([
      pool.query('SELECT year, grade, institution FROM profile_edu WHERE profile_id = $1 ORDER BY order_idx', [id]),
      pool.query('SELECT year, aldp, ict FROM profile_training WHERE profile_id = $1 ORDER BY order_idx', [id]),
      pool.query('SELECT training, year, vendor FROM profile_others WHERE profile_id = $1 ORDER BY order_idx', [id]),
      pool.query('SELECT year, position, company FROM profile_work WHERE profile_id = $1 ORDER BY order_idx', [id]),
      pool.query('SELECT dev_area, dev_program, dev_target, due_date FROM profile_idp WHERE profile_id = $1 ORDER BY order_idx', [id]),
    ]);

    res.json({
      ...mapProfile(p),
      edu: edu.rows,
      training: training.rows,
      others: others.rows,
      work: work.rows,
      idp: idp.rows.map(mapIdp),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { npk, name, dob, jobTitle, company, grade, hav, promotionDate, pa2023, pa2024, pa2025, strength, afd, photo, edu, training, others, work, idp } = req.body;

    const result = await client.query(
      `INSERT INTO profiles (npk, name, dob, job_title, company, grade, hav, promotion_date, pa_2023, pa_2024, pa_2025, strength, afd, photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [npk, name, dob || null, jobTitle, company, grade, hav, promotionDate || null, pa2023, pa2024, pa2025, strength, afd, photo || null]
    );
    const profileId = result.rows[0].id;
    await insertSubTables(client, profileId, { edu, training, others, work, idp });
    await client.query('COMMIT');
    res.status(201).json({ id: profileId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { npk, name, dob, jobTitle, company, grade, hav, promotionDate, pa2023, pa2024, pa2025, strength, afd, photo, edu, training, others, work, idp } = req.body;

    const result = await client.query(
      `UPDATE profiles SET npk=$1, name=$2, dob=$3, job_title=$4, company=$5, grade=$6, hav=$7,
       promotion_date=$8, pa_2023=$9, pa_2024=$10, pa_2025=$11, strength=$12, afd=$13, photo=$14,
       updated_at=NOW() WHERE id=$15 RETURNING id`,
      [npk, name, dob || null, jobTitle, company, grade, hav, promotionDate || null, pa2023, pa2024, pa2025, strength, afd, photo || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profil tidak ditemukan' });

    await Promise.all([
      client.query('DELETE FROM profile_edu WHERE profile_id = $1', [id]),
      client.query('DELETE FROM profile_training WHERE profile_id = $1', [id]),
      client.query('DELETE FROM profile_others WHERE profile_id = $1', [id]),
      client.query('DELETE FROM profile_work WHERE profile_id = $1', [id]),
      client.query('DELETE FROM profile_idp WHERE profile_id = $1', [id]),
    ]);
    await insertSubTables(client, id, { edu, training, others, work, idp });
    await client.query('COMMIT');
    res.json({ id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Profil tidak ditemukan' });
    res.json({ message: 'Profil berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function insertSubTables(client, profileId, { edu, training, others, work, idp }) {
  for (let i = 0; i < (edu || []).length; i++) {
    const r = edu[i];
    if (!r.year && !r.grade && !r.institution) continue;
    await client.query(
      'INSERT INTO profile_edu (profile_id, year, grade, institution, order_idx) VALUES ($1,$2,$3,$4,$5)',
      [profileId, r.year || '', r.grade || '', r.institution || '', i]
    );
  }
  for (let i = 0; i < (training || []).length; i++) {
    const r = training[i];
    if (!r.year && !r.aldp && !r.ict) continue;
    await client.query(
      'INSERT INTO profile_training (profile_id, year, aldp, ict, order_idx) VALUES ($1,$2,$3,$4,$5)',
      [profileId, r.year || '', r.aldp || '', r.ict || '', i]
    );
  }
  for (let i = 0; i < (others || []).length; i++) {
    const r = others[i];
    if (!r.training && !r.year && !r.vendor) continue;
    await client.query(
      'INSERT INTO profile_others (profile_id, training, year, vendor, order_idx) VALUES ($1,$2,$3,$4,$5)',
      [profileId, r.training || '', r.year || '', r.vendor || '', i]
    );
  }
  for (let i = 0; i < (work || []).length; i++) {
    const r = work[i];
    if (!r.year && !r.position && !r.company) continue;
    await client.query(
      'INSERT INTO profile_work (profile_id, year, position, company, order_idx) VALUES ($1,$2,$3,$4,$5)',
      [profileId, r.year || '', r.position || '', r.company || '', i]
    );
  }
  for (let i = 0; i < (idp || []).length; i++) {
    const r = idp[i];
    if (!r.devArea && !r.devProgram && !r.devTarget) continue;
    await client.query(
      'INSERT INTO profile_idp (profile_id, dev_area, dev_program, dev_target, due_date, order_idx) VALUES ($1,$2,$3,$4,$5,$6)',
      [profileId, r.devArea || '', r.devProgram || '', r.devTarget || '', r.dueDate || null, i]
    );
  }
}

module.exports = router;
