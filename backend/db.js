const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,                    // maks koneksi paralel
  idleTimeoutMillis: 30000,   // tutup koneksi idle setelah 30 detik
  connectionTimeoutMillis: 5000, // timeout konek ke DB
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

module.exports = pool;
