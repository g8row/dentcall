import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

interface OverviewStats {
    total_dentists: number;
    total_calls: number;
    interested_rate: number;
    active_callers: number;
    today_calls: number;
    today_capacity: number;
    overall_coverage: number;
    pending_callbacks: number;
}

interface RegionStats {
    region: string;
    total: number;
    called: number;
    coverage_percent: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    interest_rate: number;
}

interface CallerStats {
    id: string;
    username: string;
    total_calls: number;
    today_calls: number;
    daily_target: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    days_active: number;
    avg_per_day: number;
}

interface DailyStats {
    date: string;
    total: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    other: number;
}

interface RecentCall {
    id: string;
    called_at: string;
    caller_name: string;
    facility_name: string;
    region: string;
    outcome: string;
    notes: string | null;
}

interface OutcomeStats {
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    order_taken: number;
}

// Get comprehensive dashboard statistics
export async function GET() {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Overview Stats
        const totalDentists = (db.prepare(`SELECT COUNT(*) as count FROM dentists`).get() as { count: number }).count;
        const totalCalls = (db.prepare(`SELECT COUNT(*) as count FROM calls`).get() as { count: number }).count;

        const outcomesCounts = db.prepare(`
            SELECT 
                SUM(CASE WHEN outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
                SUM(CASE WHEN outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
                SUM(CASE WHEN outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
                SUM(CASE WHEN outcome = 'CALLBACK' THEN 1 ELSE 0 END) as callback,
                SUM(CASE WHEN outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as order_taken
            FROM calls
        `).get() as { interested: number; not_interested: number; no_answer: number; callback: number; order_taken: number };

        const interestedRate = totalCalls > 0
            ? Math.round((outcomesCounts.interested / totalCalls) * 100)
            : 0;

        const activeCallers = (db.prepare(`
            SELECT COUNT(DISTINCT caller_id) as count 
            FROM calls 
            WHERE DATE(called_at) >= DATE('now', '-30 days')
        `).get() as { count: number }).count;

        const todayCalls = (db.prepare(`
            SELECT COUNT(*) as count 
            FROM calls 
            WHERE DATE(called_at) = DATE('now')
        `).get() as { count: number }).count;

        const todayCapacity = (db.prepare(`
            SELECT COALESCE(SUM(daily_target), 0) as capacity 
            FROM users 
            WHERE role = 'CALLER'
        `).get() as { capacity: number }).capacity;

        const calledDentists = (db.prepare(`
            SELECT COUNT(DISTINCT dentist_id) as count FROM calls
        `).get() as { count: number }).count;

        const overallCoverage = totalDentists > 0
            ? Math.round((calledDentists / totalDentists) * 100)
            : 0;

        const pendingCallbacks = (db.prepare(`
            SELECT COUNT(DISTINCT dentist_id) as count 
            FROM calls c1
            WHERE outcome = 'CALLBACK'
            AND NOT EXISTS (
                SELECT 1 FROM calls c2 
                WHERE c2.dentist_id = c1.dentist_id 
                AND c2.called_at > c1.called_at
                AND c2.outcome IN ('INTERESTED', 'NOT_INTERESTED')
            )
        `).get() as { count: number }).count;

        const overview: OverviewStats = {
            total_dentists: totalDentists,
            total_calls: totalCalls,
            interested_rate: interestedRate,
            active_callers: activeCallers,
            today_calls: todayCalls,
            today_capacity: todayCapacity,
            overall_coverage: overallCoverage,
            pending_callbacks: pendingCallbacks,
        };

        // 2. Region Stats
        const regions = db.prepare(`
            SELECT 
                d.region,
                COUNT(DISTINCT d.id) as total,
                COUNT(DISTINCT c.dentist_id) as called,
                SUM(CASE WHEN c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
                SUM(CASE WHEN c.outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
                SUM(CASE WHEN c.outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
                SUM(CASE WHEN c.outcome = 'CALLBACK' THEN 1 ELSE 0 END) as callback,
                SUM(CASE WHEN c.outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as order_taken
            FROM dentists d
            LEFT JOIN calls c ON d.id = c.dentist_id
            GROUP BY d.region
            ORDER BY d.region
        `).all() as Array<{
            region: string;
            total: number;
            called: number;
            interested: number;
            not_interested: number;
            no_answer: number;
            callback: number;
        }>;

        const regionStats: RegionStats[] = regions.map(r => ({
            ...r,
            coverage_percent: r.total > 0 ? Math.round((r.called / r.total) * 100) : 0,
            interest_rate: (r.interested + r.not_interested + r.no_answer + r.callback) > 0
                ? Math.round((r.interested / (r.interested + r.not_interested + r.no_answer + r.callback)) * 100)
                : 0,
        }));

        // 3. Caller Stats
        const callers = db.prepare(`
            SELECT 
                u.id,
                u.username,
                u.daily_target,
                COUNT(c.id) as total_calls,
                SUM(CASE WHEN DATE(c.called_at) = DATE('now') THEN 1 ELSE 0 END) as today_calls,
                SUM(CASE WHEN c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
                SUM(CASE WHEN c.outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
                SUM(CASE WHEN c.outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
                SUM(CASE WHEN c.outcome = 'CALLBACK' THEN 1 ELSE 0 END) as callback,
                SUM(CASE WHEN c.outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as order_taken,
                COUNT(DISTINCT DATE(c.called_at)) as days_active
            FROM users u
            LEFT JOIN calls c ON u.id = c.caller_id
            WHERE u.role = 'CALLER'
            GROUP BY u.id
            ORDER BY COUNT(c.id) DESC
        `).all() as Array<{
            id: string;
            username: string;
            daily_target: number;
            total_calls: number;
            today_calls: number;
            interested: number;
            not_interested: number;
            no_answer: number;
            callback: number;
            days_active: number;
        }>;

        const callerStats: CallerStats[] = callers.map(c => ({
            ...c,
            avg_per_day: c.days_active > 0 ? Math.round(c.total_calls / c.days_active) : 0,
        }));

        // 4. Daily Stats (last 30 days)
        const rawDailyStats = db.prepare(`
            SELECT 
                DATE(called_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
                SUM(CASE WHEN outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
                SUM(CASE WHEN outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
                SUM(CASE WHEN outcome = 'CALLBACK' THEN 1 ELSE 0 END) as callback,
                SUM(CASE WHEN outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as order_taken,
                SUM(CASE WHEN outcome NOT IN ('INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN') OR outcome IS NULL THEN 1 ELSE 0 END) as other
            FROM calls
            WHERE DATE(called_at) >= DATE('now', '-30 days')
            GROUP BY DATE(called_at)
            ORDER BY DATE(called_at) ASC
        `).all() as (DailyStats & { other: number })[];

        // Fill in missing days
        const dailyStats: (DailyStats & { other: number })[] = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const existing = rawDailyStats.find(s => s.date === dateStr);
            if (existing) {
                dailyStats.push(existing);
            } else {
                dailyStats.push({
                    date: dateStr,
                    total: 0,
                    interested: 0,
                    not_interested: 0,
                    no_answer: 0,
                    callback: 0,
                    other: 0
                });
            }
        }

        // 5. Outcome Stats
        const outcomes: OutcomeStats = {
            interested: outcomesCounts.interested || 0,
            not_interested: outcomesCounts.not_interested || 0,
            no_answer: outcomesCounts.no_answer || 0,
            callback: outcomesCounts.callback || 0,
            order_taken: outcomesCounts.order_taken || 0,
        };

        // 6. Recent Calls
        const recentCalls = db.prepare(`
            SELECT 
                c.id,
                c.called_at,
                u.username as caller_name,
                d.facility_name,
                d.region,
                c.outcome,
                c.notes
            FROM calls c
            JOIN users u ON c.caller_id = u.id
            JOIN dentists d ON c.dentist_id = d.id
            ORDER BY c.called_at DESC
            LIMIT 20
        `).all() as RecentCall[];

        // 7. Weekly Comparison
        const thisWeekCalls = (db.prepare(`
            SELECT COUNT(*) as count 
            FROM calls 
            WHERE DATE(called_at) >= DATE('now', 'weekday 0', '-7 days')
        `).get() as { count: number }).count;

        const lastWeekCalls = (db.prepare(`
            SELECT COUNT(*) as count 
            FROM calls 
            WHERE DATE(called_at) >= DATE('now', 'weekday 0', '-14 days')
            AND DATE(called_at) < DATE('now', 'weekday 0', '-7 days')
        `).get() as { count: number }).count;

        const weeklyChange = lastWeekCalls > 0
            ? Math.round(((thisWeekCalls - lastWeekCalls) / lastWeekCalls) * 100)
            : (thisWeekCalls > 0 ? 100 : 0);

        // 8. Top Performers
        const topPerformers = callerStats
            .filter(c => c.total_calls > 0)
            .sort((a, b) => b.interested - a.interested)
            .slice(0, 3)
            .map(c => ({ username: c.username, interested: c.interested }));

        // 9. Top Regions by Interest Rate
        const topRegions = regionStats
            .filter(r => (r.interested + r.not_interested + r.no_answer + r.callback) >= 10)
            .sort((a, b) => b.interest_rate - a.interest_rate)
            .slice(0, 3)
            .map(r => ({ region: r.region, interest_rate: r.interest_rate }));

        return NextResponse.json({
            overview,
            regions: regionStats,
            callers: callerStats,
            daily_stats: dailyStats,
            outcomes,
            recent_calls: recentCalls,
            weekly: {
                this_week: thisWeekCalls,
                last_week: lastWeekCalls,
                change_percent: weeklyChange,
            },
            top_performers: topPerformers,
            top_regions: topRegions,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json({ error: 'Failed to load dashboard stats' }, { status: 500 });
    }
}
