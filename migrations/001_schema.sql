-- EduRealtime D1 schema
-- Run with: npx wrangler d1 execute edu-realtime --remote --file=./migrations/001_schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  co_instructor_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TEXT,
  ended_at TEXT,
  max_students INTEGER NOT NULL DEFAULT 100,
  ai_enabled INTEGER NOT NULL DEFAULT 1,
  join_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (instructor_id) REFERENCES users(id),
  FOREIGN KEY (co_instructor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  rtk_participant_id TEXT,
  joined_at TEXT,
  left_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS breakout_rooms (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
