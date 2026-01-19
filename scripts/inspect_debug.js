
const Database = require('better-sqlite3');

const DB_PATH = 'dentcall.db';
const db = new Database(DB_PATH);

const row = db.prepare('SELECT facility_name, cities_served FROM dentists WHERE cities_served LIKE "%u0413%" LIMIT 1').get();

if (row) {
    console.log('Facility:', row.facility_name);
    console.log('Raw cities_served:', row.cities_served);
    try {
        const parsed = JSON.parse(row.cities_served);
        console.log('Parsed:', parsed);
        console.log('Is Array:', Array.isArray(parsed));
        if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('First element:', parsed[0]);
        }
    } catch (e) {
        console.error('JSON Parse Error:', e);
    }
} else {
    console.log('No matching row found.');
}
