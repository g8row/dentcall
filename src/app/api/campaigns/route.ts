import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Get all campaigns - group by continuous date ranges
export async function GET() {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all assignment dates with counts
    const assignments = db.prepare(`
    SELECT 
      DATE(a.date) as date,
      COUNT(*) as total,
      SUM(CASE WHEN a.completed = 1 THEN 1 ELSE 0 END) as completed,
      GROUP_CONCAT(DISTINCT d.region) as regions
    FROM assignments a
    JOIN dentists d ON a.dentist_id = d.id
    GROUP BY DATE(a.date)
    ORDER BY DATE(a.date) DESC
  `).all() as {
        date: string;
        total: number;
        completed: number;
        regions: string;
    }[];

    // Group consecutive dates into campaigns
    const campaigns: {
        id: string;
        name: string;
        start_date: string;
        end_date: string;
        regions: Set<string>;
        total_assignments: number;
        completed_assignments: number;
        dates: string[];
    }[] = [];

    let currentCampaign: typeof campaigns[0] | null = null;

    for (const a of assignments.reverse()) {
        const prevDate = currentCampaign ? new Date(currentCampaign.end_date) : null;
        const currDate = new Date(a.date);

        // If this date is more than 2 days after the previous, start new campaign
        const daysDiff = prevDate ? (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24) : 999;

        if (!currentCampaign || daysDiff > 2) {
            // Start new campaign
            if (currentCampaign) campaigns.push(currentCampaign);
            currentCampaign = {
                id: `campaign-${campaigns.length}`,
                name: '',
                start_date: a.date,
                end_date: a.date,
                regions: new Set(a.regions?.split(',') || []),
                total_assignments: a.total,
                completed_assignments: a.completed,
                dates: [a.date],
            };
        } else {
            // Extend current campaign
            currentCampaign.end_date = a.date;
            currentCampaign.total_assignments += a.total;
            currentCampaign.completed_assignments += a.completed;
            currentCampaign.dates.push(a.date);
            a.regions?.split(',').forEach(r => currentCampaign!.regions.add(r));
        }
    }
    if (currentCampaign) campaigns.push(currentCampaign);

    // Enrich with outcome stats
    const enrichedCampaigns = campaigns.reverse().map(c => {
        const outcomes = db.prepare(`
      SELECT 
        c.outcome,
        COUNT(*) as count
      FROM calls c
      WHERE DATE(c.called_at) >= ? AND DATE(c.called_at) <= ?
      GROUP BY c.outcome
    `).all(c.start_date, c.end_date) as { outcome: string; count: number }[];

        const outcomeStats: Record<string, number> = {};
        outcomes.forEach(o => { outcomeStats[o.outcome] = o.count; });

        return {
            id: c.id,
            name: `Campaign ${c.start_date}${c.start_date !== c.end_date ? ` - ${c.end_date}` : ''}`,
            start_date: c.start_date,
            end_date: c.end_date,
            regions: Array.from(c.regions).join(', '),
            status: c.completed_assignments === c.total_assignments && c.total_assignments > 0 ? 'COMPLETED' : 'ACTIVE',
            total_assignments: c.total_assignments,
            completed_assignments: c.completed_assignments,
            outcomes: outcomeStats,
            dates: c.dates,
        };
    });

    return NextResponse.json({ campaigns: enrichedCampaigns });
}

// Cancel/delete a campaign by its dates
export async function DELETE(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    try {
        // Delete assignments in date range
        const result = db.prepare(`
      DELETE FROM assignments 
      WHERE DATE(date) >= ? AND DATE(date) <= ?
    `).run(startDate, endDate);

        return NextResponse.json({
            success: true,
            deleted: result.changes,
            message: `Deleted ${result.changes} assignments from ${startDate} to ${endDate}`
        });
    } catch (error) {
        console.error('Delete campaign error:', error);
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
}
