import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');

// Check if we're in build mode - skip DB initialization during build
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (isBuildTime) {
    // Return a mock/dummy during build to prevent lock issues
    throw new Error('Database not available during build time');
  }

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  // Initialize tables
  _db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CALLER',
        daily_target INTEGER NOT NULL DEFAULT 50,
        must_reset_password INTEGER NOT NULL DEFAULT 1,
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
        preferred_caller_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (preferred_caller_id) REFERENCES users(id)
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
        campaign_id TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (dentist_id) REFERENCES dentists(id),
        FOREIGN KEY (caller_id) REFERENCES users(id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        target_regions TEXT,
        target_cities TEXT,
        target_callers TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        cancelled_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_dentists_region ON dentists(region);
      CREATE INDEX IF NOT EXISTS idx_dentists_cities ON dentists(cities_served);
      CREATE INDEX IF NOT EXISTS idx_dentists_preferred_caller ON dentists(preferred_caller_id);
      CREATE INDEX IF NOT EXISTS idx_dentists_region_city ON dentists(region, cities_served);
      CREATE INDEX IF NOT EXISTS idx_calls_dentist ON calls(dentist_id);
      CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
      CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(called_at);
      CREATE INDEX IF NOT EXISTS idx_calls_dentist_date ON calls(dentist_id, called_at);
      CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
      CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
      CREATE INDEX IF NOT EXISTS idx_assignments_caller ON assignments(caller_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_date_caller ON assignments(date, caller_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_completed ON assignments(completed);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    `);

  // Migration: Add must_reset_password column if it doesn't exist
  const userColumns = _db.pragma('table_info(users)') as Array<{ name: string }>;
  const hasMustResetPassword = userColumns.some(col => col.name === 'must_reset_password');
  if (!hasMustResetPassword) {
    _db.exec(`ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0`);
    logger.migration('Added must_reset_password column to users table');
  }

  // Migration: Add campaign_id column to assignments if it doesn't exist
  const assignmentColumns = _db.pragma('table_info(assignments)') as Array<{ name: string }>;
  const hasCampaignId = assignmentColumns.some(col => col.name === 'campaign_id');
  if (!hasCampaignId) {
    _db.exec(`ALTER TABLE assignments ADD COLUMN campaign_id TEXT`);
    logger.migration('Added campaign_id column to assignments table');
  }

  // Create index for campaign_id (safe to run after migration ensures column exists)
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_assignments_campaign ON assignments(campaign_id)`);

  // Migration: Add preferred_caller_id column to dentists if it doesn't exist
  const dentistColumns = _db.pragma('table_info(dentists)') as Array<{ name: string }>;
  const hasPreferredCaller = dentistColumns.some(col => col.name === 'preferred_caller_id');
  if (!hasPreferredCaller) {
    _db.exec(`ALTER TABLE dentists ADD COLUMN preferred_caller_id TEXT`);
    logger.migration('Added preferred_caller_id column to dentists table');
  }

  // Create index for preferred_caller_id (safe to run after migration ensures column exists)
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_dentists_preferred_caller ON dentists(preferred_caller_id)`);

  // Migration: Add wants_implants column to dentists if it doesn't exist
  const hasWantsImplants = dentistColumns.some(col => col.name === 'wants_implants');
  if (!hasWantsImplants) {
    _db.exec(`ALTER TABLE dentists ADD COLUMN wants_implants INTEGER DEFAULT 0`);
    logger.migration('Added wants_implants column to dentists table');
  }

  // Create index for wants_implants (for filtering implant doctors)
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_dentists_wants_implants ON dentists(wants_implants)`);

  // Migration: Add eik column to dentists if it doesn't exist
  const hasEik = dentistColumns.some(col => col.name === 'eik');
  if (!hasEik) {
    _db.exec(`ALTER TABLE dentists ADD COLUMN eik TEXT`);
    logger.migration('Added eik column to dentists table');
  }

  // Migration: Add display_name column to users if it doesn't exist
  const hasDisplayName = userColumns.some(col => col.name === 'display_name');
  if (!hasDisplayName) {
    _db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`);
    // Backfill existing users: copy username to display_name
    _db.exec(`UPDATE users SET display_name = username WHERE display_name IS NULL`);
    logger.migration('Added display_name column to users table and backfilled from username');
  }

  return _db;
}

// Use a proxy to make db access lazy
const db = new Proxy({} as Database.Database, {
  get(_, prop) {
    const realDb = getDb();
    const value = realDb[prop as keyof Database.Database];
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    return value;
  }
});

export default db;

// Initialize backup scheduler
import { initBackupScheduler } from './scheduler';
// Only run in production or distinct dev server environment to avoid hot-reload spam, 
// but for simplicity/robustness here we just run it. 
// A check for global var prevents re-init (handled inside initBackupScheduler).
if (process.env.NODE_ENV !== 'test') {
  initBackupScheduler();
}


// Helper types
export type Role = 'ADMIN' | 'CALLER';

export type CallOutcome =
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'NO_ANSWER'
  | 'CALLBACK'
  | 'ORDER_TAKEN';

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  password: string;
  role: Role;
  daily_target: number;
  must_reset_password: number;
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
  preferred_caller_id: string | null;
  wants_implants: number;
  eik: string | null;
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
  campaign_id: string | null;
  completed: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  target_regions: string | null;
  target_cities: string | null;
  target_callers: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}
