import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, generateId } from '@/lib/auth';

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

        let inserted = 0;
        let skipped = 0;
        let errors = 0;

        // Prepare statements for performance
        const checkNameRegion = db.prepare(
            'SELECT id FROM dentists WHERE facility_name = ? AND region = ?'
        );

        // We'll use a transaction for faster inserts
        const insertTx = db.transaction((dentists: any[]) => {
            const insertStmt = db.prepare(`
                INSERT INTO dentists (
                    id, facility_name, region, manager, phones, 
                    services, cities_served, locations, staff, 
                    staff_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);

            for (const dentist of dentists) {
                try {
                    // Map incoming JSON fields to DB columns
                    const facilityName = dentist.name;
                    const region = dentist.region_filter;

                    // 1. Basic duplicate check: Name + Region
                    const existing = checkNameRegion.get(facilityName, region);
                    if (existing) {
                        skipped++;
                        continue;
                    }

                    // Prepare data
                    const id = generateId();
                    const manager = dentist.manager || null;
                    const phones = JSON.stringify(dentist.phones || []);
                    // Map contract_packages to services
                    const services = JSON.stringify(dentist.contract_packages || []);

                    // Extract cities from locations
                    const cities = new Set<string>();
                    if (dentist.locations && Array.isArray(dentist.locations)) {
                        dentist.locations.forEach((loc: any) => {
                            if (loc.city) cities.add(loc.city);
                        });
                    }
                    const cities_served = JSON.stringify(Array.from(cities));

                    const locations = JSON.stringify(dentist.locations || []);
                    // Map dentists array to staff
                    const staff = JSON.stringify(dentist.dentists || []);
                    const staff_count = dentist.dentists ? dentist.dentists.length : 0;

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
                        staff_count
                    );
                    inserted++;
                } catch (e) {
                    console.error('Error importing row:', e);
                    errors++;
                }
            }
        });

        // Run the transaction
        insertTx(data);

        return NextResponse.json({
            success: true,
            inserted,
            skipped,
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
