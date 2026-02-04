import { NextRequest, NextResponse } from 'next/server';
import db, { Call } from '@/lib/db';
import { getSession, generateId } from '@/lib/auth';

// Get calls with filters
export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dentistId = searchParams.get('dentist_id');
    const callerId = searchParams.get('caller_id');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '100');

    let whereClause = '1=1';
    const params: (string | number)[] = [];

    if (dentistId) {
        whereClause += ' AND dentist_id = ?';
        params.push(dentistId);
    }

    if (callerId) {
        whereClause += ' AND caller_id = ?';
        params.push(callerId);
    }

    if (date) {
        whereClause += ' AND DATE(called_at) = ?';
        params.push(date);
    }

    const calls = db.prepare(`
    SELECT c.*, d.facility_name, d.phones, u.username as caller_name
    FROM calls c
    JOIN dentists d ON c.dentist_id = d.id
    JOIN users u ON c.caller_id = u.id
    WHERE ${whereClause}
    ORDER BY c.called_at DESC
    LIMIT ?
  `).all(...params, limit);

    return NextResponse.json({ calls });
}

// Log a new call
export async function POST(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { dentist_id, outcome, notes } = await request.json();

        if (!dentist_id || !outcome) {
            return NextResponse.json(
                { error: 'dentist_id and outcome are required' },
                { status: 400 }
            );
        }

        const validOutcomes = ['INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN'];
        if (!validOutcomes.includes(outcome)) {
            return NextResponse.json(
                { error: 'Invalid outcome' },
                { status: 400 }
            );
        }

        const id = generateId();

        db.prepare(`
      INSERT INTO calls (id, dentist_id, caller_id, outcome, notes, called_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(id, dentist_id, session.user.id, outcome, notes || null);

        // Update assignment notes so the "sticky note" stays in sync
        db.prepare(`
      UPDATE assignments 
      SET notes = ? 
      WHERE dentist_id = ? AND completed = 0
    `).run(notes || null, dentist_id);

        // Mark assignment as completed if exists (regardless of date or caller)
        // If we called them, any pending assignment for this dentist is considered done
        db.prepare(`
      UPDATE assignments 
      SET completed = 1 
      WHERE dentist_id = ? AND completed = 0
    `).run(dentist_id);

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Log call error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
