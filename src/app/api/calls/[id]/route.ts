import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// Update a call (edit outcome/notes)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const { outcome, notes } = await request.json();

        // Check if call exists and belongs to user (or user is admin)
        const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id) as { caller_id: string } | undefined;

        if (!call) {
            return NextResponse.json({ error: 'Call not found' }, { status: 404 });
        }

        // Only allow editing own calls (unless admin)
        if (session.role !== 'ADMIN' && call.caller_id !== session.user.id) {
            return NextResponse.json({ error: 'Cannot edit other users\' calls' }, { status: 403 });
        }

        const validOutcomes = ['INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN'];
        if (outcome && !validOutcomes.includes(outcome)) {
            return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
        }

        const updates: string[] = [];
        const values: (string | null)[] = [];

        if (outcome) {
            updates.push('outcome = ?');
            values.push(outcome);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            values.push(notes || null);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        values.push(id);
        db.prepare(`UPDATE calls SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update call error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Delete a call (admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;

        db.prepare('DELETE FROM calls WHERE id = ?').run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete call error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
