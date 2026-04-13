/**
 * Database layer.
 *
 * LOCAL DEV  — uses better-sqlite3 (fast, offline, file-backed).
 *              Active when CLOUDFLARE_D1_DATABASE_ID is NOT set.
 *
 * PRODUCTION — uses the D1 binding via getCloudflareContext() from
 *              @opennextjs/cloudflare. No extra API token needed —
 *              the binding is injected by the Workers runtime.
 *              Active when CLOUDFLARE_D1_DATABASE_ID is set.
 *
 * All exported functions are async so callers work in both environments.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'instructor' | 'student';
  avatar_url: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  meeting_id: string;
  instructor_id: string;
  instructor_name: string;
  instructor_email: string;
  co_instructor_id: string | null;
  co_instructor_name: string | null;
  status: 'scheduled' | 'active' | 'ended';
  scheduled_at: string | null;
  ended_at: string | null;
  max_students: number;
  ai_enabled: number;
  join_code: string;
  created_at: string;
  participant_count?: number;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  user_id: string;
  role: 'instructor' | 'co_instructor' | 'student';
  rtk_participant_id: string | null;
  joined_at: string | null;
  left_at: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface BreakoutRoomRow {
  id: string;
  session_id: string;
  name: string;
  meeting_id: string;
  created_at: string;
}

// ── Driver abstraction ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface Driver {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

// ── Local SQLite driver (better-sqlite3) ──────────────────────────────────

function makeSQLiteDriver(): Driver {
  // Dynamic require so the Workers build never imports this module
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Database = require('better-sqlite3') as any;
  const path = require('path') as typeof import('path');
  const fs = require('fs') as typeof import('fs');

  const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'edu-realtime.db');
  const dir = path.dirname(DB_PATH);
  if (DB_PATH !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    async query<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
      return db.prepare(sql).all(...(params ?? [])) as T[];
    },
    async run(sql: string, params?: unknown[]): Promise<void> {
      db.prepare(sql).run(...(params ?? []));
    },
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },
  };
}

// ── Cloudflare D1 binding driver ─────────────────────────────────────────
// Uses the DB binding injected by the Workers runtime — no API token needed.

/** Minimal D1 interface (avoids requiring @cloudflare/workers-types) */
interface D1Db {
  prepare(sql: string): D1Stmt;
}
interface D1Stmt {
  bind(...params: unknown[]): D1BoundStmt;
}
interface D1BoundStmt {
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<void>;
}

async function getD1Binding(): Promise<D1Db> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const { env } = getCloudflareContext();
  const db = (env as Record<string, unknown>).DB as D1Db | undefined;
  if (!db) throw new Error('D1 binding "DB" not found in Workers env. Check wrangler.toml.');
  return db;
}

function makeD1Driver(): Driver {
  return {
    async query<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
      const db = await getD1Binding();
      const result = await db.prepare(sql).bind(...(params ?? [])).all<T>();
      return result.results ?? [];
    },
    async run(sql: string, params?: unknown[]): Promise<void> {
      const db = await getD1Binding();
      await db.prepare(sql).bind(...(params ?? [])).run();
    },
    async exec(sql: string): Promise<void> {
      const db = await getD1Binding();
      const stmts = sql.split(';').map((s) => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await db.prepare(stmt).bind().run();
      }
    },
  };
}

// ── Singleton driver ──────────────────────────────────────────────────────

let _driver: Driver | null = null;

function getDriver(): Driver {
  if (_driver) return _driver;
  _driver = process.env.CLOUDFLARE_D1_DATABASE_ID
    ? makeD1Driver()
    : makeSQLiteDriver();
  return _driver;
}

// ── Schema initialisation ─────────────────────────────────────────────────

let _schemaInit = false;

async function ensureSchema(): Promise<void> {
  if (_schemaInit) return;
  _schemaInit = true;
  const d = getDriver();
  await d.exec(`
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
  `);
}

// ── Users ─────────────────────────────────────────────────────────────────

export async function createUser(user: {
  id: string; email: string; password_hash: string; name: string; role: 'instructor' | 'student';
}): Promise<void> {
  await ensureSchema();
  await getDriver().run(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.email, user.password_hash, user.name, user.role]
  );
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  await ensureSchema();
  const rows = await getDriver().query<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  await ensureSchema();
  const rows = await getDriver().query<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function createSession(s: {
  id: string; title: string; description?: string; meeting_id: string;
  instructor_id: string; co_instructor_id?: string; scheduled_at?: string;
  max_students?: number; ai_enabled?: boolean; join_code: string;
}): Promise<void> {
  await ensureSchema();
  await getDriver().run(
    `INSERT INTO sessions (id, title, description, meeting_id, instructor_id, co_instructor_id,
      scheduled_at, max_students, ai_enabled, join_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, s.title, s.description ?? null, s.meeting_id, s.instructor_id,
     s.co_instructor_id ?? null, s.scheduled_at ?? null,
     s.max_students ?? 100, s.ai_enabled !== false ? 1 : 0, s.join_code]
  );
}

export async function getSessionById(id: string): Promise<SessionRow | undefined> {
  await ensureSchema();
  const rows = await getDriver().query<SessionRow>(
    `SELECT s.*, u.name as instructor_name, u.email as instructor_email,
            ci.name as co_instructor_name
     FROM sessions s
     JOIN users u ON u.id = s.instructor_id
     LEFT JOIN users ci ON ci.id = s.co_instructor_id
     WHERE s.id = ?`, [id]
  );
  return rows[0];
}

export async function getSessionByJoinCode(join_code: string): Promise<SessionRow | undefined> {
  await ensureSchema();
  const rows = await getDriver().query<SessionRow>(
    `SELECT s.*, u.name as instructor_name, u.email as instructor_email
     FROM sessions s
     JOIN users u ON u.id = s.instructor_id
     WHERE s.join_code = ?`, [join_code]
  );
  return rows[0];
}

export async function getAllSessions(limit = 50): Promise<SessionRow[]> {
  await ensureSchema();
  return getDriver().query<SessionRow>(
    `SELECT s.*, u.name as instructor_name, u.email as instructor_email,
            (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = s.id AND sp.left_at IS NULL) as participant_count
     FROM sessions s JOIN users u ON u.id = s.instructor_id
     ORDER BY s.created_at DESC LIMIT ?`, [limit]
  );
}

export async function getSessionsByInstructor(instructor_id: string): Promise<SessionRow[]> {
  await ensureSchema();
  return getDriver().query<SessionRow>(
    `SELECT s.*, u.name as instructor_name,
            (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = s.id) as participant_count
     FROM sessions s JOIN users u ON u.id = s.instructor_id
     WHERE s.instructor_id = ?
     ORDER BY s.created_at DESC`, [instructor_id]
  );
}

export async function updateSessionStatus(id: string, status: 'scheduled' | 'active' | 'ended'): Promise<void> {
  await ensureSchema();
  const ended_at = status === 'ended' ? new Date().toISOString() : null;
  await getDriver().run('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?', [status, ended_at, id]);
}

// ── Participants ──────────────────────────────────────────────────────────

export async function upsertSessionParticipant(p: {
  id: string; session_id: string; user_id: string;
  role: 'instructor' | 'co_instructor' | 'student'; rtk_participant_id?: string;
}): Promise<void> {
  await ensureSchema();
  await getDriver().run(
    `INSERT INTO session_participants (id, session_id, user_id, role, rtk_participant_id, joined_at)
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(session_id, user_id) DO UPDATE SET
       rtk_participant_id = excluded.rtk_participant_id,
       joined_at = excluded.joined_at, left_at = NULL`,
    [p.id, p.session_id, p.user_id, p.role, p.rtk_participant_id ?? null]
  );
}

export async function getSessionParticipants(session_id: string): Promise<ParticipantRow[]> {
  await ensureSchema();
  return getDriver().query<ParticipantRow>(
    `SELECT sp.*, u.name, u.email, u.avatar_url
     FROM session_participants sp JOIN users u ON u.id = sp.user_id
     WHERE sp.session_id = ? ORDER BY sp.joined_at ASC`, [session_id]
  );
}

// ── Breakout rooms ────────────────────────────────────────────────────────

export async function createBreakoutRoom(room: {
  id: string; session_id: string; name: string; meeting_id: string;
}): Promise<void> {
  await ensureSchema();
  await getDriver().run(
    'INSERT INTO breakout_rooms (id, session_id, name, meeting_id) VALUES (?, ?, ?, ?)',
    [room.id, room.session_id, room.name, room.meeting_id]
  );
}

export async function getBreakoutRooms(session_id: string): Promise<BreakoutRoomRow[]> {
  await ensureSchema();
  return getDriver().query<BreakoutRoomRow>(
    'SELECT * FROM breakout_rooms WHERE session_id = ?', [session_id]
  );
}
