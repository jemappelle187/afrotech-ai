-- Run this in your Vercel Postgres console or Neon dashboard

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  environment TEXT NOT NULL,     -- 'darkroom' | 'beach'
  total_tips NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tips (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL,
  item TEXT NOT NULL,            -- 'drink' | 'champagne' | 'wine'
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);




