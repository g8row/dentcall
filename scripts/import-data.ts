import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const JSON_PATH = path.join(process.cwd(), '..', 'dentists_cleaned.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables if not exist
db.exec(`
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


async function importData() {
  console.log('Reading dentist data...');

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`File not found: ${JSON_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
  const dentists = JSON.parse(rawData);

  console.log(`Found ${dentists.length} dentist records in source file`);

  // Prepare check statement
  const checkStmt = db.prepare('SELECT id FROM dentists WHERE facility_name = ? AND region = ?');

  // Insert statement
  const insertStmt = db.prepare(`
    INSERT INTO dentists (id, facility_name, region, manager, phones, services, cities_served, locations, staff, staff_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const insertMany = db.transaction((records: any[]) => {
    for (const d of records) {
      try {
        // Map fields
        const facility_name = d.name;
        const region = d.region_filter;

        if (!facility_name || !region) {
          console.warn(`Skipping invalid record: Missing name or region`);
          errors++;
          continue;
        }

        // Duplicate check
        const existing = checkStmt.get(facility_name, region);
        if (existing) {
          skipped++;
          continue;
        }

        // Prepare data
        const manager = d.manager || null;
        const phones = JSON.stringify(d.phones || []);
        const services = JSON.stringify(d.contract_packages || []);

        // Extract cities
        const cities = new Set<string>();
        if (d.locations && Array.isArray(d.locations)) {
          d.locations.forEach((loc: any) => {
            if (loc.city) cities.add(loc.city);
          });
        }
        const cities_served = JSON.stringify(Array.from(cities));

        const locations = JSON.stringify(d.locations || []);
        const staff = JSON.stringify(d.dentists || []);
        const staff_count = d.dentists ? d.dentists.length : 0;

        insertStmt.run(
          randomUUID(),
          facility_name,
          region,
          manager,
          phones,
          services,
          cities_served,
          locations,
          staff,
          staff_count
        );
        inserted++;

        if (inserted % 500 === 0) {
          console.log(`Imported ${inserted} records...`);
        }
      } catch (e) {
        console.error(`Error processing record: ${e}`);
        errors++;
      }
    }
  });

  console.log('Importing dentist data...');
  insertMany(dentists);

  console.log('-----------------------------------');
  console.log(`Import Summary:`);
  console.log(`- Inserted: ${inserted}`);
  console.log(`- Skipped (Duplicates): ${skipped}`);
  console.log(`- Errors: ${errors}`);

  const count = db.prepare('SELECT COUNT(*) as count FROM dentists').get() as { count: number };
  console.log(`✅ Successfully imported ${count.count} dentist records`);

  // Verify regions
  const regions = db.prepare('SELECT DISTINCT region FROM dentists').all() as { region: string }[];
  console.log(`\nRegions: ${regions.map(r => r.region).join(', ')}`);

  db.close();
}

importData().catch(console.error);
