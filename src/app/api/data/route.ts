import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// Delete call history and/or assignments (admin only)
export async function DELETE(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'all';

        let callsDeleted = 0;
        let assignmentsDeleted = 0;

        if (type === 'calls' || type === 'all') {
            const result = db.prepare('DELETE FROM calls').run();
            callsDeleted = result.changes;
        }

        if (type === 'assignments' || type === 'all') {
            const result = db.prepare('DELETE FROM assignments').run();
            assignmentsDeleted = result.changes;
        }

        return NextResponse.json({
            success: true,
            deleted: {
                calls: callsDeleted,
                assignments: assignmentsDeleted,
            },
            message: `Deleted ${callsDeleted} calls and ${assignmentsDeleted} assignments`,
        });
    } catch (error) {
        console.error('Delete data error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
