/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'mahjong.db');

// Ensure directory exists if needed
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Pragmas for reliability and speed
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lobbies (
      id TEXT PRIMARY KEY,
      host_player_id TEXT NOT NULL,
      status TEXT NOT NULL, -- 'waiting', 'active', 'finalized'
      starting_chips INTEGER NOT NULL DEFAULT 1000,
      house_rules TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finalized_at INTEGER,
      FOREIGN KEY (host_player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS lobby_seats (
      lobby_id TEXT NOT NULL,
      seat_index INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      chips INTEGER NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (lobby_id, seat_index),
      UNIQUE (lobby_id, player_id),
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS transfer_requests (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      initiator_player_id TEXT NOT NULL,
      sender_player_id TEXT NOT NULL,
      recipient_player_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason_type TEXT NOT NULL,
      reason_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected', 'cancelled', 'failed'
      failure_reason TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (initiator_player_id) REFERENCES players(id),
      FOREIGN KEY (sender_player_id) REFERENCES players(id),
      FOREIGN KEY (recipient_player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS session_results (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      seat_index INTEGER NOT NULL,
      starting_chips INTEGER NOT NULL,
      ending_chips INTEGER NOT NULL,
      net_chips INTEGER NOT NULL,
      position INTEGER NOT NULL,
      is_tied INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE (lobby_id, player_id),
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_lobby ON transfer_requests(lobby_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_transfers_pending ON transfer_requests(lobby_id, status);
    CREATE INDEX IF NOT EXISTS idx_session_results_player ON session_results(player_id);
    CREATE INDEX IF NOT EXISTS idx_session_results_lobby ON session_results(lobby_id);
  `);
}

initDb();
