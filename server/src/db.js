import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// Privacy: nothing in this schema stores IP addresses, locations or raw client ids.
// Clients are identified only by an HMAC-SHA256 of their X-Client-Id (see identity.js).
const MIGRATIONS = [
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_hash TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    device      TEXT    NOT NULL CHECK (device IN ('desktop', 'mobile', 'unknown')),
    created_at  TEXT    NOT NULL,
    edited_at   TEXT
  );
  CREATE INDEX messages_client_hash ON messages (client_hash);
  CREATE TABLE identities (
    client_hash  TEXT    PRIMARY KEY,
    name         TEXT    NOT NULL,
    last_post_at INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE TABLE ask_usage (
    day   TEXT    PRIMARY KEY,
    count INTEGER NOT NULL
  );
  `,
];

function migrate(db) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get();
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** Opens (creating if needed) the SQLite database and applies migrations. */
export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 5000');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

/** Runs fn inside a transaction (node:sqlite is synchronous, so this is atomic). */
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Returns the salt used to hash client ids: CLIENT_ID_SALT if set, otherwise a random salt
 * generated on first run and persisted in the meta table.
 */
export function resolveSalt(db, envSalt) {
  if (envSalt) return envSalt;
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('client_id_salt');
  if (row) return row.value;
  const salt = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('client_id_salt', salt);
  return salt;
}
