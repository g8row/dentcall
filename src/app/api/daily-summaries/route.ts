import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import db, { DailySummary } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/daily-summaries - Get daily summaries with optional filters
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const callerId = searchParams.get('caller_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const summaryDate = searchParams.get('summary_date');

  let query = `
    SELECT 
      ds.*,
      u.username,
      COALESCE(u.display_name, u.username) AS caller_name
    FROM daily_summaries ds
    JOIN users u ON ds.caller_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Callers can only see their own summaries, admins can see all
  if (session.role !== 'ADMIN') {
    query += ' AND ds.caller_id = ?';
    params.push(session.user.id);
  } else if (callerId) {
    query += ' AND ds.caller_id = ?';
    params.push(callerId);
  }

  if (summaryDate) {
    query += ' AND ds.summary_date = ?';
    params.push(summaryDate);
  } else {
    if (startDate) {
      query += ' AND ds.summary_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND ds.summary_date <= ?';
      params.push(endDate);
    }
  }

  query += ' ORDER BY ds.summary_date DESC, ds.created_at DESC';

  const summaries = db.prepare(query).all(...params);
  return NextResponse.json({ summaries });
}

// POST /api/daily-summaries - Create or update daily summary
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { summary_date, summary_notes, call_ids } = body;

    if (!summary_date || !summary_notes) {
      return NextResponse.json(
        { error: 'Missing required fields: summary_date, summary_notes' },
        { status: 400 }
      );
    }

    // Use caller_id from session (callers can only create summaries for themselves)
    const callerId = session.user.id;

    // Count calls for this date if call_ids provided
    let callCount = 0;
    if (call_ids && Array.isArray(call_ids)) {
      callCount = call_ids.length;
    } else if (call_ids) {
      // If string of comma-separated IDs
      callCount = call_ids.split(',').filter((id: string) => id.trim()).length;
    }

    // Check if summary already exists for this caller and date
    const existing = db
      .prepare('SELECT id FROM daily_summaries WHERE caller_id = ? AND summary_date = ?')
      .get(callerId, summary_date) as DailySummary | undefined;

    if (existing) {
      // Update existing summary
      db.prepare(`
        UPDATE daily_summaries 
        SET summary_notes = ?, call_count = ?, call_ids = ?
        WHERE id = ?
      `).run(
        summary_notes,
        callCount,
        call_ids ? (Array.isArray(call_ids) ? call_ids.join(',') : call_ids) : null,
        existing.id
      );

      const updated = db
        .prepare('SELECT * FROM daily_summaries WHERE id = ?')
        .get(existing.id);

      return NextResponse.json({ success: true, summary: updated });
    } else {
      // Create new summary
      const id = nanoid();
      db.prepare(`
        INSERT INTO daily_summaries (id, caller_id, summary_date, summary_notes, call_count, call_ids)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        callerId,
        summary_date,
        summary_notes,
        callCount,
        call_ids ? (Array.isArray(call_ids) ? call_ids.join(',') : call_ids) : null
      );

      const summary = db
        .prepare('SELECT * FROM daily_summaries WHERE id = ?')
        .get(id);

      return NextResponse.json({ success: true, summary }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating daily summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create daily summary' },
      { status: 500 }
    );
  }
}
