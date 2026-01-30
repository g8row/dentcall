import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { fromUserId, toUserId } = await request.json();

        if (!fromUserId || !toUserId) {
            return NextResponse.json({ error: 'Missing user IDs' }, { status: 400 });
        }

        if (fromUserId === toUserId) {
            return NextResponse.json({ error: 'Cannot transfer to same user' }, { status: 400 });
        }

        const result = db.prepare(
            'UPDATE dentists SET preferred_caller_id = ? WHERE preferred_caller_id = ?'
        ).run(toUserId, fromUserId);

        return NextResponse.json({
            success: true,
            message: `Transferred ${result.changes} dentists`
        });

    } catch (error) {
        console.error('Transfer dentists error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
