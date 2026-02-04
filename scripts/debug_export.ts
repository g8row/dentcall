import Database from 'better-sqlite3';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const db = new Database(DB_PATH);

console.log("Testing export logic...");

try {
    let data: any[] = db.prepare(`
        SELECT 
          d.facility_name as "Facility Name",
          d.region as "Region",
          d.manager as "Manager",
          d.phones as "Phones",
          d.cities_served as "Cities",
          d.staff_count as "Staff Count",
          u.username as "Preferred Caller",
          (SELECT outcome FROM calls WHERE dentist_id = d.id ORDER BY called_at DESC LIMIT 1) as "Last Outcome",
          (SELECT called_at FROM calls WHERE dentist_id = d.id ORDER BY called_at DESC LIMIT 1) as "Last Called"
        FROM dentists d
        LEFT JOIN users u ON d.preferred_caller_id = u.id
        ORDER BY d.region, d.facility_name
      `).all();

    console.log(`Query returned ${data.length} rows.`);

    // Parse phones and cities JSON safely
    data = data.map(row => {
        let phones = '';
        let cities = '';

        try {
            phones = JSON.parse((row.Phones as string) || '[]').join(', ');
        } catch {
            phones = row.Phones as string || '';
        }

        try {
            // Cities might be JSON ["City"] or legacy "City;City" string
            const rawCities = row.Cities as string || '';
            if (rawCities.trim().startsWith('[')) {
                cities = JSON.parse(rawCities).join(', ');
            } else {
                cities = rawCities.split(';').map((c: string) => c.trim()).filter(Boolean).join(', ');
            }
        } catch {
            cities = row.Cities as string || '';
        }

        return { ...row, Phones: phones, Cities: cities };
    });

    console.log("Data processing complete.");

    // Create workbook using array of arrays for more reliable encoding
    const wb = XLSX.utils.book_new();

    // Get headers
    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => row[h]));

        // Create worksheet from array of arrays
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        console.log("Sheet created.");

        XLSX.utils.book_append_sheet(wb, ws, 'Data');

        // Write to buffer with explicit options
        const uint8Array = XLSX.write(wb, {
            type: 'buffer',
            bookType: 'xlsx',
            compression: true
        });

        console.log(`Export success! Buffer size: ${uint8Array.length} bytes`);
    } else {
        console.log("No data to export.");
    }

} catch (error) {
    console.error("Export FAILED:", error);
}
