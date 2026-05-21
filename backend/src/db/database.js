import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = process.env.DATABASE_FILE || path.resolve(__dirname, '../../data/monitoramento.sqlite');
const resolvedDbFile = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);

fs.mkdirSync(path.dirname(resolvedDbFile), { recursive: true });

export const db = new Database(resolvedDbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
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
      enabled INTEGER NOT NULL DEFAULT 0,
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.prepare('ALTER TABLE cameras ADD COLUMN excel_code TEXT').run();
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }

  try {
    db.prepare('ALTER TABLE cameras ADD COLUMN image_url TEXT').run();
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }

  try {
    db.prepare('ALTER TABLE cameras ADD COLUMN stream_url TEXT').run();
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }

  for (const column of ['stream_ip', 'stream_login', 'stream_password']) {
    try {
      db.prepare(`ALTER TABLE cameras ADD COLUMN ${column} TEXT`).run();
    } catch (error) {
      if (!String(error.message).includes('duplicate column name')) throw error;
    }
  }
}

export function getDbFile() {
  return resolvedDbFile;
}
