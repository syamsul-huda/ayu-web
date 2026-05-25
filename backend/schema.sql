CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npk VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  dob DATE,
  job_title VARCHAR(100),
  company VARCHAR(100),
  grade VARCHAR(50),
  hav VARCHAR(50),
  promotion_date DATE,
  pa_year1 VARCHAR(20) DEFAULT '2023',
  pa_val1  VARCHAR(50),
  pa_year2 VARCHAR(20) DEFAULT '2024',
  pa_val2  VARCHAR(50),
  pa_year3 VARCHAR(20) DEFAULT '2025',
  pa_val3  VARCHAR(50),
  strength TEXT,
  afd TEXT,
  photo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_edu (
  id SERIAL PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  year VARCHAR(20),
  grade VARCHAR(50),
  institution TEXT,
  order_idx INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_training (
  id SERIAL PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  year VARCHAR(20),
  aldp TEXT,
  ict TEXT,
  order_idx INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_others (
  id SERIAL PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  training TEXT,
  year VARCHAR(20),
  vendor VARCHAR(100),
  order_idx INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_work (
  id SERIAL PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  year VARCHAR(20),
  position VARCHAR(100),
  company VARCHAR(100),
  order_idx INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_idp (
  id SERIAL PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dev_area TEXT,
  dev_program TEXT,
  dev_target TEXT,
  due_date DATE,
  order_idx INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS artikels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  author VARCHAR(100),
  date DATE,
  content TEXT,
  tags TEXT,
  cover TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  year VARCHAR(20),
  client VARCHAR(100),
  role VARCHAR(100),
  url VARCHAR(500),
  description TEXT,
  technologies TEXT,
  cover TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_settings (
  id SERIAL PRIMARY KEY,
  gaji_pokok BIGINT NOT NULL DEFAULT 0,
  overtime_rate BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_overtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tgl DATE NOT NULL,
  jam NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_additional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulan INTEGER NOT NULL,
  tahun INTEGER NOT NULL,
  deskripsi VARCHAR(255),
  nominal BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_closed_months (
  id SERIAL PRIMARY KEY,
  bulan INTEGER NOT NULL,
  tahun INTEGER NOT NULL,
  closed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bulan, tahun)
);

ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS nama VARCHAR(100) DEFAULT '';
ALTER TABLE payroll_settings ADD COLUMN IF NOT EXISTS jabatan VARCHAR(100) DEFAULT '';

-- Migration: ganti kolom pa_2023/pa_2024/pa_2025 ke pa_year+val yang dinamis
-- Jalankan ini sekali pada database yang sudah ada:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pa_year1 VARCHAR(20) DEFAULT '2023';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pa_val1  VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pa_year2 VARCHAR(20) DEFAULT '2024';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pa_val2  VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pa_year3 VARCHAR(20) DEFAULT '2025';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pa_val3  VARCHAR(50);
-- Migrasi data lama (opsional):
UPDATE profiles SET pa_val1 = pa_2023, pa_val2 = pa_2024, pa_val3 = pa_2025 WHERE pa_val1 IS NULL;
