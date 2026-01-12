const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const db = new Database(DB_PATH);

console.log('Syncing assignment completion status from calls...');

// Get all dentist IDs that have been called with a valid outcome
const calledDentists = db.prepare(`
    SELECT DISTINCT dentist_id 
    FROM calls 
    WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'FOLLOW_UP')
`).all().map(r => r.dentist_id);

console.log(`Found ${calledDentists.length} dentists with logged calls.`);

// Mark all assignments for these dentists as completed
const updateStmt = db.prepare(`
    UPDATE assignments 
    SET completed = 1 
    WHERE dentist_id = ? AND completed = 0
`);

let updatedCount = 0;
const transaction = db.transaction(() => {
    for (const dentistId of calledDentists) {
        const res = updateStmt.run(dentistId);
        updatedCount += res.changes;
    }
});

transaction();

console.log(`✅ Updated ${updatedCount} assignments to COMPLETED status.`);
