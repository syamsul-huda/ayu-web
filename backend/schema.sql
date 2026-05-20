CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
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
  pa_2023 VARCHAR(50),
  pa_2024 VARCHAR(50),
  pa_2025 VARCHAR(50),
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
