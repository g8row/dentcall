import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { dentistIds, callerId } = await request.json();

        if (!Array.isArray(dentistIds) || dentistIds.length === 0) {
            return NextResponse.json({ error: 'No dentists selected' }, { status: 400 });
        }

        // CallerId can be null (to unassign) or a valid ID
        // If it's a string 'null' or empty, treat as null
        const targetCallerId = (callerId === 'null' || callerId === '') ? null : callerId;

        const placeholders = dentistIds.map(() => '?').join(',');
        const query = `UPDATE dentists SET preferred_caller_id = ? WHERE id IN (${placeholders})`;

        const params = [targetCallerId, ...dentistIds];

        const result = db.prepare(query).run(...params);

        return NextResponse.json({
            success: true,
            message: `Updated ${result.changes} dentists`
        });

    } catch (error) {
        console.error('Bulk assign error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
