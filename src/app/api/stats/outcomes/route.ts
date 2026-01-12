import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// Get call outcome stats per day (for calendar view)
export async function GET() {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get outcome stats grouped by date
    const stats = db.prepare(`
    SELECT 
      DATE(called_at) as date,
      outcome,
      COUNT(*) as count
    FROM calls
    GROUP BY DATE(called_at), outcome
    ORDER BY DATE(called_at) DESC
    LIMIT 500
  `).all() as { date: string; outcome: string; count: number }[];

    // Group by date
    const byDate: Record<string, Record<string, number>> = {};
    for (const stat of stats) {
        if (!byDate[stat.date]) {
            byDate[stat.date] = {};
        }
        byDate[stat.date][stat.outcome] = stat.count;
    }

    return NextResponse.json({ stats: byDate });
}
