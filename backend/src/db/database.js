import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseUrl = process.env.DATABASE_URL;

export const isPostgres = Boolean(databaseUrl);

let sqliteDb = null;
let pool = null;

if (isPostgres) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
} else {
  const { default: Database } = await import('better-sqlite3');
  const dbFile = process.env.DATABASE_FILE || path.resolve(__dirname, '../../data/monitoramento.sqlite');
  const resolvedDbFile = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
  fs.mkdirSync(path.dirname(resolvedDbFile), { recursive: true });
  sqliteDb = new Database(resolvedDbFile);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
}

function normalizeSql(sql, params) {
  if (!isPostgres) return { sql, params };
  let index = 0;
  return {
    sql: sql
      .replace(/CURRENT_TIMESTAMP/g, 'NOW()')
      .replace(/\?/g, () => `$${++index}`),
    params
  };
}

export async function all(sql, params = []) {
  if (!isPostgres) return sqliteDb.prepare(sql).all(...params);
  const query = normalizeSql(sql, params);
  const result = await pool.query(query.sql, query.params);
  return result.rows;
}

export async function get(sql, params = []) {
  if (!isPostgres) return sqliteDb.prepare(sql).get(...params);
  const query = normalizeSql(sql, params);
  const result = await pool.query(query.sql, query.params);
  return result.rows[0];
}

export async function run(sql, params = []) {
  if (!isPostgres) return sqliteDb.prepare(sql).run(...params);
  const query = normalizeSql(sql, params);
  const result = await pool.query(query.sql, query.params);
  return { changes: result.rowCount, lastInsertRowid: result.rows?.[0]?.id };
}

export async function exec(sql) {
  if (!isPostgres) return sqliteDb.exec(sql);
  return pool.query(sql);
}

export async function migrate() {
  if (isPostgres) {
    await exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vessels (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cameras (
        id SERIAL PRIMARY KEY,
        vessel_id INTEGER NOT NULL REFERENCES vessels(id),
        excel_code TEXT,
        name TEXT NOT NULL,
        location TEXT,
        image_url TEXT,
        stream_url TEXT,
        stream_ip TEXT,
        stream_login TEXT,
        stream_password TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS checks (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        vessel_id INTEGER NOT NULL REFERENCES vessels(id),
        camera_id INTEGER NOT NULL REFERENCES cameras(id),
        status TEXT NOT NULL CHECK(status IN ('Online','Offline','Manutenção','Sem acesso')),
        observation TEXT,
        behavior_note TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(date, time_slot, camera_id)
      );

      CREATE TABLE IF NOT EXISTS observations (
        id SERIAL PRIMARY KEY,
        check_id INTEGER NOT NULL REFERENCES checks(id),
        note TEXT NOT NULL,
        behavior_note TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS excel_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        excel_url TEXT,
        worksheet_name TEXT,
        google_sheet_url TEXT,
        google_webhook_url TEXT,
        enabled BOOLEAN NOT NULL DEFAULT false,
        last_sync_at TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS access_requests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ,
        reviewed_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        model TEXT,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
        received_at TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE excel_settings ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
      ALTER TABLE excel_settings ADD COLUMN IF NOT EXISTS google_webhook_url TEXT;
    `);
    return;
  }

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vessels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vessel_id INTEGER NOT NULL,
      excel_code TEXT,
      name TEXT NOT NULL,
      location TEXT,
      image_url TEXT,
      stream_url TEXT,
      stream_ip TEXT,
      stream_login TEXT,
      stream_password TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vessel_id) REFERENCES vessels(id)
    );

    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      vessel_id INTEGER NOT NULL,
      camera_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Online','Offline','Manutenção','Sem acesso')),
      observation TEXT,
      behavior_note TEXT,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, time_slot, camera_id),
      FOREIGN KEY (vessel_id) REFERENCES vessels(id),
      FOREIGN KEY (camera_id) REFERENCES cameras(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      behavior_note TEXT,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (check_id) REFERENCES checks(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS excel_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      excel_url TEXT,
      worksheet_name TEXT,
      google_sheet_url TEXT,
      google_webhook_url TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      reviewed_by INTEGER,
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      model TEXT,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      received_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const column of ['excel_code', 'image_url', 'stream_url', 'stream_ip', 'stream_login', 'stream_password']) {
    try {
      sqliteDb.prepare(`ALTER TABLE cameras ADD COLUMN ${column} TEXT`).run();
    } catch (error) {
      if (!String(error.message).includes('duplicate column name')) throw error;
    }
  }

  for (const column of ['google_sheet_url', 'google_webhook_url']) {
    try {
      sqliteDb.prepare(`ALTER TABLE excel_settings ADD COLUMN ${column} TEXT`).run();
    } catch (error) {
      if (!String(error.message).includes('duplicate column name')) throw error;
    }
  }
}

export function getDbFile() {
  return process.env.DATABASE_FILE || path.resolve(__dirname, '../../data/monitoramento.sqlite');
}
