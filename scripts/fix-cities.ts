import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const db = new Database(DB_PATH);

const FIXES: Record<string, string> = {
    'ОФИЯ': 'СОФИЯ',
    'ТАРА ЗАГОРА': 'СТАРА ЗАГОРА',
    'ЛИВЕН': 'СЛИВЕН',
    'МОЛЯН': 'СМОЛЯН',
    'ИЛИСТРА': 'СИЛИСТРА',
    'АНДАНСКИ': 'САНДАНСКИ',
    'ВИЛЕНГРАД': 'СВИЛЕНГРАД',
    'ЕВЛИЕВО': 'СЕВЛИЕВО',
    'ВОГЕ': 'СВОГЕ',
    'ОПОТ': 'СОПОТ',
    'ОЗОПОЛ': 'СОЗОПОЛ',
    'АМОКОВ': 'САМОКОВ',
    'ВИЩОВ': 'СВИЩОВ',
    'АПАРЕВА БАНЯ': 'САПАРЕВА БАНЯ',
    'ОФИЯ 02 рн КРАСНО СЕЛО': 'СОФИЯ 02 рн КРАСНО СЕЛО',
    'ОФИЯ 10 рн ТРИАДИЦА': 'СОФИЯ 10 рн ТРИАДИЦА',
    // Add prefix fix for variations
};

function fixText(text: string): string {
    if (!text) return text;

    let fixed = text;
    // Fix full words
    for (const [bad, good] of Object.entries(FIXES)) {
        // Replace exact match or word boundary
        // Simple replaceAll for the bad token if it's clearly a city name
        // Be careful not to replace inside other words if 'ОФИЯ' exists elsewhere? 
        // Unlikely in uppercase city names.
        if (fixed.includes(bad)) {
            fixed = fixed.split(bad).join(good);
        }
    }
    return fixed;
}

function run() {
    console.log('Fixing broken city names in DB...');

    const dentists = db.prepare('SELECT id, cities_served, locations FROM dentists').all() as { id: string, cities_served: string, locations: string }[];

    const updateStmt = db.prepare('UPDATE dentists SET cities_served = ?, locations = ? WHERE id = ?');

    let count = 0;

    const transaction = db.transaction(() => {
        for (const d of dentists) {
            let changed = false;
            let newCities = d.cities_served;
            let newLocations = d.locations;

            // Fix cities_served
            if (newCities) {
                const fixed = fixText(newCities);
                if (fixed !== newCities) {
                    newCities = fixed;
                    changed = true;
                }
            }

            // Fix locations JSON
            if (newLocations) {
                try {
                    const locs = JSON.parse(newLocations);
                    let locChanged = false;
                    for (const loc of locs) {
                        if (loc.city) {
                            const fixedCity = fixText(loc.city);
                            if (fixedCity !== loc.city) {
                                loc.city = fixedCity;
                                locChanged = true;
                            }
                        }
                        if (loc.municipality) {
                            const fixedMun = fixText(loc.municipality);
                            if (fixedMun !== loc.municipality) {
                                loc.municipality = fixedMun;
                                locChanged = true;
                            }
                        }
                    }
                    if (locChanged) {
                        newLocations = JSON.stringify(locs);
                        changed = true;
                    }
                } catch (e) {
                    console.warn(`Failed to parse locations for ${d.id}`);
                }
            }

            if (changed) {
                updateStmt.run(newCities, newLocations, d.id);
                count++;
            }
        }
    });

    transaction();
    console.log(`✅ Fixed city names for ${count} dentists`);
}

run();
