import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let fixedCount = 0;
        let mergedCount = 0;

        // Transaction for safety
        const cleanupTx = db.transaction(() => {
            // 1. Find all dentists with 'РЗОК' in region
            const rzokRecords = db.prepare("SELECT * FROM dentists WHERE region LIKE 'РЗОК%'").all() as any[];

            for (const row of rzokRecords) {
                const originalRegion = row.region;
                // Remove 'РЗОК' prefix (case insensitive)
                const cleanRegion = originalRegion.replace(/^РЗОК\s+/i, '').trim();
                const name = row.facility_name;

                if (!cleanRegion) continue;

                // Check for clean record
                const cleanRecord = db.prepare(
                    "SELECT * FROM dentists WHERE facility_name = ? AND region = ?"
                ).get(name, cleanRegion) as any;

                if (cleanRecord) {
                    // MERGE
                    // Transfer preferred caller if needed
                    if (!cleanRecord.preferred_caller_id && row.preferred_caller_id) {
                        db.prepare("UPDATE dentists SET preferred_caller_id = ? WHERE id = ?")
                            .run(row.preferred_caller_id, cleanRecord.id);
                    }

                    // Merge phones
                    try {
                        const cleanPhones = JSON.parse(cleanRecord.phones || '[]');
                        const dupPhones = JSON.parse(row.phones || '[]');
                        const combined = Array.from(new Set([...cleanPhones, ...dupPhones]));

                        if (combined.length > cleanPhones.length) {
                            db.prepare("UPDATE dentists SET phones = ? WHERE id = ?")
                                .run(JSON.stringify(combined), cleanRecord.id);
                        }
                    } catch (e) {
                        console.error('Error parsing phones during merge', e);
                    }

                    // Merge History (update assignments/calls to point to clean record)
                    // Update calls
                    db.prepare("UPDATE calls SET dentist_id = ? WHERE dentist_id = ?")
                        .run(cleanRecord.id, row.id);

                    // Update assignments
                    db.prepare("UPDATE assignments SET dentist_id = ? WHERE dentist_id = ?")
                        .run(cleanRecord.id, row.id);

                    // Delete duplicate
                    db.prepare("DELETE FROM dentists WHERE id = ?").run(row.id);
                    mergedCount++;
                } else {
                    // RENAME
                    db.prepare("UPDATE dentists SET region = ? WHERE id = ?")
                        .run(cleanRegion, row.id);
                    fixedCount++;
                }
            }
        });

        cleanupTx();

        return NextResponse.json({
            success: true,
            merged: mergedCount,
            fixed: fixedCount
        });

    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
