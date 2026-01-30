
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const db = new Database(DB_PATH);

console.log('Checking database schema...');

// 1. Check users.display_name
const userColumns = db.pragma('table_info(users)');
const hasDisplayName = userColumns.some(col => col.name === 'display_name');

if (!hasDisplayName) {
    console.log('Adding display_name to users...');
    db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`);
    db.exec(`UPDATE users SET display_name = username WHERE display_name IS NULL`);
    console.log('Done.');
} else {
    console.log('users.display_name already exists.');
}

// 2. Check dentists.preferred_caller_id
let dentistColumns = db.pragma('table_info(dentists)');
let hasPreferredCaller = dentistColumns.some(col => col.name === 'preferred_caller_id');

if (!hasPreferredCaller) {
    console.log('Adding preferred_caller_id to dentists...');
    db.exec(`ALTER TABLE dentists ADD COLUMN preferred_caller_id TEXT`);
    console.log('Done.');
} else {
    console.log('dentists.preferred_caller_id already exists.');
}

// 3. Check dentists.wants_implants
dentistColumns = db.pragma('table_info(dentists)');
const hasWantsImplants = dentistColumns.some(col => col.name === 'wants_implants');

if (!hasWantsImplants) {
    console.log('Adding wants_implants to dentists...');
    db.exec(`ALTER TABLE dentists ADD COLUMN wants_implants INTEGER DEFAULT 0`);
    console.log('Done.');
} else {
    console.log('dentists.wants_implants already exists.');
}

// 4. Check dentists.eik
dentistColumns = db.pragma('table_info(dentists)');
const hasEik = dentistColumns.some(col => col.name === 'eik');

if (!hasEik) {
    console.log('Adding eik to dentists...');
    db.exec(`ALTER TABLE dentists ADD COLUMN eik TEXT`);
    console.log('Done.');
} else {
    console.log('dentists.eik already exists.');
}

// 5. Check assignments.campaign_id
const assignmentColumns = db.pragma('table_info(assignments)');
const hasCampaignId = assignmentColumns.some(col => col.name === 'campaign_id');

if (!hasCampaignId) {
    console.log('Adding campaign_id to assignments...');
    db.exec(`ALTER TABLE assignments ADD COLUMN campaign_id TEXT`);
    console.log('Done.');
} else {
    console.log('assignments.campaign_id already exists.');
}

console.log('Repair complete.');
