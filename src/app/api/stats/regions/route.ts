import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// Get region progress stats
export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    const whereClause = region ? 'WHERE d.region = ?' : '';
    const params = region ? [region] : [];

    const stats = db.prepare(`
    SELECT 
      d.region,
      COUNT(DISTINCT d.id) as total_dentists,
      COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN d.id END) as called_dentists,
      COUNT(DISTINCT CASE WHEN c.outcome = 'INTERESTED' THEN d.id END) as interested_dentists,
      COUNT(DISTINCT CASE WHEN c.outcome = 'NOT_INTERESTED' THEN d.id END) as not_interested_dentists,
      COUNT(DISTINCT CASE WHEN c.outcome = 'CALLBACK' THEN d.id END) as callback_dentists,
      COUNT(DISTINCT CASE WHEN c.outcome = 'NO_ANSWER' THEN d.id END) as no_answer_dentists
    FROM dentists d
    LEFT JOIN calls c ON d.id = c.dentist_id
    ${whereClause}
    GROUP BY d.region
    ORDER BY d.region
  `).all(...params) as Array<{
        region: string;
        total_dentists: number;
        called_dentists: number;
        interested_dentists: number;
        not_interested_dentists: number;
        callback_dentists: number;
        no_answer_dentists: number;
    }>;

    const enrichedStats = stats.map(s => ({
        ...s,
        uncalled_dentists: s.total_dentists - s.called_dentists,
        coverage_percent: s.total_dentists > 0
            ? Math.round((s.called_dentists / s.total_dentists) * 100)
            : 0,
        interest_rate: s.called_dentists > 0
            ? Math.round((s.interested_dentists / s.called_dentists) * 100)
            : 0,
    }));

    return NextResponse.json({ stats: enrichedStats });
}
