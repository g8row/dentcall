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
            // 1. Find all duplicates by facility_name
            const duplicates = db.prepare(`
                SELECT facility_name, COUNT(*) as count 
                FROM dentists 
                GROUP BY facility_name 
                HAVING count > 1
            `).all() as { facility_name: string }[];

            for (const dup of duplicates) {
                const records = db.prepare(
                    "SELECT * FROM dentists WHERE facility_name = ? ORDER BY created_at DESC"
                ).all(dup.facility_name) as any[];

                if (records.length < 2) continue;

                // Strategy: Keep the NEWEST one (likely the clean import), merge others into it
                // Exception: If newest is 'dirty' (has ОФИЯ) and older is clean?
                // But we just imported clean data, so newest should be clean.

                // Let's verify 'cleanliness' just in case.
                // Prefer record WITHOUT 'ОФИЯ' in cities_served
                let survivorIndex = 0;
                const cleanRecordIndex = records.findIndex(r => !r.cities_served?.includes('ОФИЯ') && !r.cities_served?.includes('\\"ОФИЯ\\"'));

                if (cleanRecordIndex !== -1) {
                    survivorIndex = cleanRecordIndex;
                }

                const survivor = records[survivorIndex];
                const victims = records.filter((_, idx) => idx !== survivorIndex);

                for (const victim of victims) {
                    // Merge History
                    db.prepare("UPDATE calls SET dentist_id = ? WHERE dentist_id = ?")
                        .run(survivor.id, victim.id);

                    db.prepare("UPDATE assignments SET dentist_id = ? WHERE dentist_id = ?")
                        .run(survivor.id, victim.id);

                    // Merge Phones (if victim has phones survivor doesn't)
                    try {
                        const sPhones = JSON.parse(survivor.phones || '[]');
                        const vPhones = JSON.parse(victim.phones || '[]');
                        const combined = Array.from(new Set([...sPhones, ...vPhones]));
                        if (combined.length > sPhones.length) {
                            db.prepare("UPDATE dentists SET phones = ? WHERE id = ?")
                                .run(JSON.stringify(combined), survivor.id);
                        }
                    } catch (e) { }

                    // Delete victim
                    db.prepare("DELETE FROM dentists WHERE id = ?").run(victim.id);
                    mergedCount++;
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
