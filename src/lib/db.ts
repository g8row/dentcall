import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CALLER',
    daily_target INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dentists (
    id TEXT PRIMARY KEY,
    facility_name TEXT NOT NULL,
    region TEXT NOT NULL,
    manager TEXT,
    phones TEXT NOT NULL,
    services TEXT,
    cities_served TEXT,
    locations TEXT,
    staff TEXT,
    staff_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    dentist_id TEXT NOT NULL,
    caller_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    notes TEXT,
    called_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dentist_id) REFERENCES dentists(id),
    FOREIGN KEY (caller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    dentist_id TEXT NOT NULL,
    caller_id TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dentist_id) REFERENCES dentists(id),
    FOREIGN KEY (caller_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_dentists_region ON dentists(region);
  CREATE INDEX IF NOT EXISTS idx_dentists_cities ON dentists(cities_served);
  CREATE INDEX IF NOT EXISTS idx_calls_dentist ON calls(dentist_id);
  CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
  CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(called_at);
  CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
  CREATE INDEX IF NOT EXISTS idx_assignments_caller ON assignments(caller_id);
`);

export default db;

// Helper types
export type Role = 'ADMIN' | 'CALLER';

export type CallOutcome =
    | 'INTERESTED'
    | 'NOT_INTERESTED'
    | 'NO_ANSWER'
    | 'CALLBACK'
    | 'FOLLOW_UP';

export interface User {
    id: string;
    username: string;
    password: string;
    role: Role;
    daily_target: number;
    created_at: string;
}

export interface Dentist {
    id: string;
    facility_name: string;
    region: string;
    manager: string | null;
    phones: string;
    services: string | null;
    cities_served: string | null;
    locations: string | null;
    staff: string | null;
    staff_count: number | null;
    created_at: string;
}

export interface Call {
    id: string;
    dentist_id: string;
    caller_id: string;
    outcome: CallOutcome;
    notes: string | null;
    called_at: string;
}

export interface Assignment {
    id: string;
    date: string;
    dentist_id: string;
    caller_id: string;
    completed: number;
    created_at: string;
}
