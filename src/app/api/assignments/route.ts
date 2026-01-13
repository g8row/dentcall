import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, generateId } from '@/lib/auth';
import { addDays, format, startOfWeek, endOfWeek } from 'date-fns';

interface User {
    id: string;
    username: string;
    daily_target: number;
}

interface DayStats {
    date: string;
    region: string;
    caller_name: string;
    caller_id: string;
    total: number;
    completed: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    other: number;
}

// Get assignments with enriched stats
export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const week = searchParams.get('week');
        const callerId = searchParams.get('caller_id');
        const includeStats = searchParams.get('stats') === 'true';

        console.log('[GET /api/assignments] Params:', { date, week, callerId, includeStats });

        let whereClause = '1=1';
        const params: string[] = [];

        if (date) {
            whereClause += ' AND DATE(a.date) = ?';
            params.push(date);
        } else if (week) {
            const days = parseInt(searchParams.get('days') || '7');

            // Validate week string
            const weekDate = new Date(week);
            if (isNaN(weekDate.getTime())) {
                console.error('[GET /api/assignments] Invalid week date:', week);
                return NextResponse.json({ error: 'Invalid week date format' }, { status: 400 });
            }

            // Calculate range
            const startDate = new Date(weekDate);
            const endDate = addDays(startDate, days - 1);

            whereClause += ' AND DATE(a.date) >= ? AND DATE(a.date) <= ?';
            params.push(format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'));
        }

        // Non-admins can only see their own assignments
        if (session.role !== 'ADMIN') {
            whereClause += ' AND a.caller_id = ?';
            params.push(session.user.id);
        } else if (callerId) {
            whereClause += ' AND a.caller_id = ?';
            params.push(callerId);
        }

        const assignments = db.prepare(`
    SELECT a.*, d.facility_name, d.region, d.phones, d.manager, d.cities_served,
           u.username as caller_name
    FROM assignments a
    JOIN dentists d ON a.dentist_id = d.id
    JOIN users u ON a.caller_id = u.id
    WHERE ${whereClause}
    ORDER BY a.date, d.region, d.facility_name
  `).all(...params);

        // Enrich with last call data
        const enrichedAssignments = (assignments as Array<Record<string, unknown>>).map((a) => {
            let phones = [];
            try {
                phones = JSON.parse((a.phones as string) || '[]');
            } catch (e) {
                console.error(`[GET /api/assignments] Failed to parse phones for assignment ${a.id}:`, a.phones);
                phones = [];
            }
            return {
                ...a,
                phones,
            };
        });

        // If stats requested (for calendar view), calculate per-day breakdown
        let dayStats: Record<string, {
            regions: Record<string, number>;
            callers: Record<string, {
                total: number;
                completed: number;
                name: string;
                interested: number;
                not_interested: number;
                no_answer: number;
                callback: number;
                other: number;
            }>
        }> = {};

        if (includeStats && session.role === 'ADMIN') {
            const statsQuery = db.prepare(`
        SELECT 
            DATE(a.date) as date,
            d.region,
            u.username as caller_name,
            a.caller_id,
            COUNT(*) as total,
            SUM(CASE WHEN a.completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
            SUM(CASE WHEN a.completed = 1 AND c.outcome IN ('CALLBACK', 'FOLLOW_UP') THEN 1 ELSE 0 END) as callback,
            SUM(CASE WHEN a.completed = 1 AND (c.outcome IS NULL OR c.outcome NOT IN ('INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'FOLLOW_UP')) THEN 1 ELSE 0 END) as other
        FROM assignments a
        JOIN dentists d ON a.dentist_id = d.id
        JOIN users u ON a.caller_id = u.id
        LEFT JOIN (
            SELECT dentist_id, outcome
            FROM calls c1
            WHERE called_at = (
                SELECT MAX(called_at) 
                FROM calls c2 
                WHERE c2.dentist_id = c1.dentist_id
            )
        ) c ON a.dentist_id = c.dentist_id
        WHERE ${whereClause}
        GROUP BY DATE(a.date), d.region, a.caller_id
        ORDER BY DATE(a.date), d.region
        `).all(...params) as DayStats[];

            for (const stat of statsQuery) {
                const dateKey = stat.date;
                if (!dayStats[dateKey]) {
                    dayStats[dateKey] = { regions: {}, callers: {} };
                }

                // Aggregate regions
                dayStats[dateKey].regions[stat.region] = (dayStats[dateKey].regions[stat.region] || 0) + stat.total;

                // Aggregate callers
                if (!dayStats[dateKey].callers[stat.caller_id]) {
                    dayStats[dateKey].callers[stat.caller_id] = {
                        total: 0,
                        completed: 0,
                        name: stat.caller_name,
                        interested: 0,
                        not_interested: 0,
                        no_answer: 0,
                        callback: 0,
                        other: 0
                    };
                }
                const callerStat = dayStats[dateKey].callers[stat.caller_id];
                callerStat.total += stat.total;
                callerStat.completed += stat.completed;
                callerStat.interested += stat.interested;
                callerStat.not_interested += stat.not_interested;
                callerStat.no_answer += stat.no_answer;
                callerStat.callback += stat.callback;
                callerStat.other += stat.other;
            }
        }

        return NextResponse.json({
            assignments: enrichedAssignments,
            dayStats: includeStats ? dayStats : undefined
        });

    } catch (error) {
        console.error('[GET /api/assignments] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}

// Generate schedule (admin only)
export async function POST(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { start_date, days = 7, regions, cities, append = false, caller_ids } = await request.json();

        if (!start_date) {
            return NextResponse.json(
                { error: 'start_date is required' },
                { status: 400 }
            );
        }

        // Get callers (either specified or all active)
        let callerQuery = `SELECT id, username, daily_target FROM users WHERE role = 'CALLER' AND daily_target > 0`;
        const callerParams: string[] = [];

        if (caller_ids && caller_ids.length > 0) {
            callerQuery += ` AND id IN (${caller_ids.map(() => '?').join(',')})`;
            callerParams.push(...caller_ids);
        }

        const callers = db.prepare(callerQuery).all(...callerParams) as User[];

        if (callers.length === 0) {
            return NextResponse.json(
                { error: 'No callers with daily targets configured' },
                { status: 400 }
            );
        }

        // Build location filter
        let locationFilter = '';
        const locationParams: string[] = [];

        if (regions && regions.length > 0) {
            locationFilter += ` AND d.region IN (${regions.map(() => '?').join(',')})`;
            locationParams.push(...regions);
        }

        if (cities && cities.length > 0) {
            // Filter by cities_served containing any of the specified cities
            const cityConditions = cities.map(() => `d.cities_served LIKE ?`).join(' OR ');
            locationFilter += ` AND (${cityConditions})`;
            locationParams.push(...cities.map((c: string) => `%${c}%`));
        }

        // Get dentists with smart prioritization
        const dentists = db.prepare(`
      SELECT d.id, d.region, d.cities_served,
             MAX(c.called_at) as last_called,
             MAX(CASE WHEN c.outcome = 'CALLBACK' THEN 1 ELSE 0 END) as has_callback,
             MAX(CASE WHEN c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as already_interested,
             MAX(CASE WHEN c.outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as already_rejected
      FROM dentists d
      LEFT JOIN calls c ON d.id = c.dentist_id
      WHERE 1=1 ${locationFilter}
      GROUP BY d.id
      HAVING already_interested = 0 AND already_rejected = 0
      ORDER BY 
        has_callback DESC,
        last_called IS NULL DESC,
        last_called ASC
    `).all(...locationParams) as {
            id: string;
            region: string;
            last_called: string | null;
            has_callback: number;
            already_interested: number;
            already_rejected: number;
        }[];

        // Calculate total calls needed
        const totalDailyTarget = callers.reduce((sum, c) => sum + c.daily_target, 0);
        const totalCallsNeeded = totalDailyTarget * days;

        // If not enough dentists, return info
        if (dentists.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No available dentists in the selected area (excluding already interested/rejected)',
                available_dentists: 0,
                needed: totalCallsNeeded
            }, { status: 400 });
        }

        // Clear existing assignments unless appending
        if (!append) {
            db.prepare(`
        DELETE FROM assignments 
        WHERE DATE(date) >= ? AND DATE(date) < ?
      `).run(start_date, format(addDays(new Date(start_date), days), 'yyyy-MM-dd'));
        }

        // Generate assignments - track used dentists to prevent duplicates
        let dentistIndex = 0;
        let assignmentCount = 0;
        const usedDentistIds = new Set<string>();

        const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO assignments (id, date, dentist_id, caller_id)
      VALUES (?, ?, ?, ?)
    `);

        const insertMany = db.transaction(() => {
            for (let day = 0; day < days; day++) {
                const currentDate = format(addDays(new Date(start_date), day), 'yyyy-MM-dd');

                for (const caller of callers) {
                    for (let i = 0; i < caller.daily_target; i++) {
                        // Find next unused dentist
                        while (dentistIndex < dentists.length && usedDentistIds.has(dentists[dentistIndex].id)) {
                            dentistIndex++;
                        }

                        if (dentistIndex >= dentists.length) {
                            // No more unique dentists available
                            return;
                        }

                        const dentist = dentists[dentistIndex];
                        usedDentistIds.add(dentist.id);

                        insertStmt.run(
                            generateId(),
                            currentDate,
                            dentist.id,
                            caller.id
                        );

                        assignmentCount++;
                        dentistIndex++;
                    }
                }
            }
        });

        insertMany();

        // Get region breakdown for response
        const regionBreakdown: Record<string, number> = {};
        for (let i = 0; i < Math.min(dentistIndex, dentists.length); i++) {
            const region = dentists[i].region;
            regionBreakdown[region] = (regionBreakdown[region] || 0) + 1;
        }

        return NextResponse.json({
            success: true,
            message: `Generated ${assignmentCount} assignments for ${days} days`,
            total_assignments: assignmentCount,
            available_dentists: dentists.length,
            region_breakdown: regionBreakdown,
            callers_assigned: callers.map(c => c.username)
        });
    } catch (error) {
        console.error('Generate schedule error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Delete assignments (admin only)
export async function DELETE(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        console.log('[DELETE /api/assignments] Unauthorized');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const region = searchParams.get('region');

    console.log('[DELETE /api/assignments] Params:', { date, startDate, endDate, region });

    let whereClause = '1=1';
    const params: string[] = [];

    if (date) {
        whereClause += ' AND DATE(date) = ?';
        params.push(date);
    } else if (startDate && endDate) {
        whereClause += ' AND DATE(date) >= ? AND DATE(date) <= ?';
        params.push(startDate, endDate);
    }

    if (region) {
        whereClause += ' AND dentist_id IN (SELECT id FROM dentists WHERE region = ?)';
        params.push(region);
    }

    // Check count before delete
    const beforeCount = db.prepare(`SELECT COUNT(*) as count FROM assignments WHERE ${whereClause}`).get(...params) as { count: number };
    console.log('[DELETE /api/assignments] Found', beforeCount.count, 'to delete');

    const result = db.prepare(`DELETE FROM assignments WHERE ${whereClause}`).run(...params);
    console.log('[DELETE /api/assignments] Deleted', result.changes);

    return NextResponse.json({
        success: true,
        deleted: result.changes
    });
}
