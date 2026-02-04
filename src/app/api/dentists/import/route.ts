import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, generateId, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const data = await request.json();

        if (!Array.isArray(data)) {
            return NextResponse.json(
                { error: 'Input must be an array of dentists' },
                { status: 400 }
            );
        }

        // 1. Handle Users (Preferred Callers)
        // Ensure all preferred callers exist in the DB before importing
        const uniqueCallers = new Set<string>();
        for (const item of data) {
            if (item.preferred_caller && typeof item.preferred_caller === 'string') {
                uniqueCallers.add(item.preferred_caller.trim());
            }
        }

        if (uniqueCallers.size > 0) {
            const existingUsers = db.prepare('SELECT id, username FROM users').all() as { id: string; username: string }[];
            const callerMap: Record<string, string> = {};

            // Build normalization map
            existingUsers.forEach(u => {
                callerMap[u.username.toLowerCase()] = u.id;
            });

            const defaultPasswordHash = await hashPassword('password123');
            const insertUserStmt = db.prepare(`
                INSERT INTO users (id, username, password, role, daily_target, must_reset_password)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const callerName of uniqueCallers) {
                const lowerName = callerName.toLowerCase();

                // Check if user exists (checking normalization)
                let userId = callerMap[lowerName];

                // Fallback for common aliases (matches Python script logic)
                if (!userId) {
                    if (lowerName.includes('dani')) userId = callerMap['dani'];
                    if (lowerName.match(/ico|hristo|ицо|христо/)) userId = callerMap['ico'];
                }

                // If still not found, CREATE THE USER
                if (!userId) {
                    // Decide on username: if alias matched nothing, use the name from JSON (cleaned)
                    // If it looked like 'dani', but 'dani' user didn't exist -> create 'dani'
                    let newUsername = lowerName;
                    if (lowerName.includes('dani')) newUsername = 'dani';
                    else if (lowerName.match(/ico|hristo|ицо|христо/)) newUsername = 'ico';

                    // Double check we haven't already created this username in this loop or map
                    if (!callerMap[newUsername]) {
                        console.log(`[Import] Auto-creating missing user: ${newUsername}`);
                        const newId = generateId();
                        try {
                            // Insert directly (sync)
                            insertUserStmt.run(newId, newUsername, defaultPasswordHash, 'CALLER', 50, 1);
                            callerMap[newUsername] = newId; // Update map
                        } catch (err) {
                            console.error(`Failed to auto-create user ${newUsername}`, err);
                        }
                    }
                }
            }
        }

        // Refetch users to get final map including any just created
        const finalUsers = db.prepare('SELECT id, username FROM users').all() as { id: string; username: string }[];
        const finalCallerMap: Record<string, string> = {};
        finalUsers.forEach(u => {
            finalCallerMap[u.username.toLowerCase()] = u.id;
            // Add alias mappings to the final map for the transaction to use
            if (u.username.toLowerCase() === 'dani') finalCallerMap['dani'] = u.id;
            if (u.username.toLowerCase() === 'ico') finalCallerMap['ico'] = u.id;
        });


        // 2. Perform Import (Upsert)
        let inserted = 0;
        let updated = 0;
        let errors = 0;

        const checkNameRegion = db.prepare(
            'SELECT id FROM dentists WHERE facility_name = ? AND region = ?'
        );

        const importTx = db.transaction((dentists: any[]) => {
            const insertStmt = db.prepare(`
                INSERT INTO dentists (
                    id, facility_name, region, manager, phones, 
                    services, cities_served, locations, staff, 
                    staff_count, preferred_caller_id, eik, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
            `);

            const updateStmt = db.prepare(`
                UPDATE dentists SET 
                    manager = ?,
                    phones = ?,
                    services = ?,
                    cities_served = ?,
                    locations = ?,
                    staff = ?,
                    staff_count = ?,
                    preferred_caller_id = ?,
                    eik = ?
                WHERE id = ?
            `);

            for (const dentist of dentists) {
                try {
                    const facilityName = dentist.name || dentist.facility_name;
                    const region = dentist.region || dentist.region_filter || '';
                    const eik = dentist.eik || null;

                    const manager = dentist.manager || null;
                    const phones = JSON.stringify(dentist.phones || []);
                    const services = JSON.stringify(dentist.contract_packages || []);

                    const cities = new Set<string>();
                    if (dentist.locations && Array.isArray(dentist.locations)) {
                        dentist.locations.forEach((loc: any) => {
                            if (loc.city) cities.add(loc.city);
                        });
                    }
                    const cities_served = JSON.stringify(Array.from(cities));
                    const locations = JSON.stringify(dentist.locations || []);
                    const staff = JSON.stringify(dentist.dentists || []);
                    const staff_count = dentist.dentists ? dentist.dentists.length : 0;

                    // Resolve Preferred Caller ID
                    let preferred_caller_id = null;
                    if (dentist.preferred_caller && typeof dentist.preferred_caller === 'string') {
                        const raw = dentist.preferred_caller.toLowerCase();
                        preferred_caller_id = finalCallerMap[raw] || null;

                        // Try alias fallback if direct exact match failed
                        if (!preferred_caller_id) {
                            if (raw.includes('dani')) preferred_caller_id = finalCallerMap['dani'];
                            else if (raw.match(/ico|hristo|ицо|христо/)) preferred_caller_id = finalCallerMap['ico'];
                        }
                    }

                    const existing = checkNameRegion.get(facilityName, region) as { id: string } | undefined;

                    if (existing) {
                        updateStmt.run(
                            manager,
                            phones,
                            services,
                            cities_served,
                            locations,
                            staff,
                            staff_count,
                            preferred_caller_id,
                            eik,
                            existing.id
                        );
                        updated++;
                    } else {
                        const id = generateId();
                        insertStmt.run(
                            id,
                            facilityName,
                            region,
                            manager,
                            phones,
                            services,
                            cities_served,
                            locations,
                            staff,
                            staff_count,
                            preferred_caller_id,
                            eik
                        );
                        inserted++;
                    }
                } catch (e) {
                    console.error('Error importing row:', e);
                    errors++;
                }
            }
        });

        importTx(data);

        return NextResponse.json({
            success: true,
            inserted,
            updated,
            errors
        });

    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
