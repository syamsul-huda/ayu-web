const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const requireAuth = require('../middleware/auth');

const ALLOWED_MIME = new Set(['image/jpeg','image/jpg','image/png','image/gif','image/webp']);
const ALLOWED_EXT  = new Set(['.jpg','.jpeg','.png','.gif','.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Nama file: timestamp + random — tidak ada info asli yang bocor
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error('Format tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.'));
    }
    cb(null, true);
  },
});

router.post('/', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Ukuran file maksimal 5 MB.' });
      return res.status(400).json({ error: 'Upload gagal: ' + err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diupload.' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

module.exports = router;
