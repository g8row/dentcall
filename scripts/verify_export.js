
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/cold-caller.db');
const db = new Database(dbPath);

try {
    const data = db.prepare(`
    SELECT 
        d.facility_name,
        u.username as preferred_caller
    FROM dentists d
    LEFT JOIN users u ON d.preferred_caller_id = u.id
    WHERE d.preferred_caller_id IS NOT NULL
    LIMIT 5
  `).all();

    console.log('Query Result:', JSON.stringify(data, null, 2));
} catch (error) {
    console.error('Error running query:', error);
}
