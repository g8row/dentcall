import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, generateId } from '@/lib/auth';
import { addDays, format, startOfWeek, endOfWeek } from 'date-fns';
import { logger } from '@/lib/logger';

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
    order_taken: number;
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

        logger.debug('Assignments', `GET Params: date=${date}, week=${week}, callerId=${callerId}, stats=${includeStats}`);

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
                logger.warn('Assignments', `Invalid week date: ${week}`);
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
    SELECT a.*, d.facility_name, d.region, d.phones, d.manager, d.cities_served, d.preferred_caller_id, d.wants_implants,
           COALESCE(u.display_name, u.username) as caller_name, a.notes
    FROM assignments a
    JOIN dentists d ON a.dentist_id = d.id
    JOIN users u ON a.caller_id = u.id
    LEFT JOIN campaigns c ON a.campaign_id = c.id
    WHERE ${whereClause} AND (c.status IS NULL OR c.status != 'CANCELLED')
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
            campaigns: Record<string, { name: string; total: number; completed: number }>;
            callers: Record<string, {
                total: number;
                completed: number;
                name: string;
                interested: number;
                not_interested: number;
                no_answer: number;
                callback: number;
                order_taken: number;
                other: number;
            }>
        }> = {};

        if (includeStats && session.role === 'ADMIN') {
            const statsQuery = db.prepare(`
        SELECT 
            DATE(a.date) as date,
            d.region,
            COALESCE(u.display_name, u.username) as caller_name,
            a.caller_id,
            camp.name as campaign_name,
            camp.id as campaign_id,
            COUNT(*) as total,
            SUM(CASE WHEN a.completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'CALLBACK' THEN 1 ELSE 0 END) as callback,
            SUM(CASE WHEN a.completed = 1 AND c.outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as order_taken,
            SUM(CASE WHEN a.completed = 1 AND (c.outcome IS NULL OR c.outcome NOT IN ('INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN')) THEN 1 ELSE 0 END) as other
        FROM assignments a
        JOIN dentists d ON a.dentist_id = d.id
        JOIN users u ON a.caller_id = u.id
        LEFT JOIN campaigns camp ON a.campaign_id = camp.id
        LEFT JOIN (
            SELECT dentist_id, outcome
            FROM calls c1
            WHERE called_at = (
                SELECT MAX(called_at) 
                FROM calls c2 
                WHERE c2.dentist_id = c1.dentist_id
            )
        ) c ON a.dentist_id = c.dentist_id
        WHERE ${whereClause} AND (camp.status IS NULL OR camp.status != 'CANCELLED')
        GROUP BY DATE(a.date), d.region, a.caller_id, camp.id
        ORDER BY DATE(a.date), d.region
        `).all(...params) as (DayStats & { campaign_name: string; campaign_id: string })[];

            for (const stat of statsQuery) {
                const dateKey = stat.date;
                if (!dayStats[dateKey]) {
                    dayStats[dateKey] = { regions: {}, campaigns: {}, callers: {} };
                }

                // Aggregate regions
                dayStats[dateKey].regions[stat.region] = (dayStats[dateKey].regions[stat.region] || 0) + stat.total;

                // Aggregate campaigns
                if (stat.campaign_id) {
                    if (!dayStats[dateKey].campaigns[stat.campaign_id]) {
                        dayStats[dateKey].campaigns[stat.campaign_id] = { name: stat.campaign_name, total: 0, completed: 0 };
                    }
                    dayStats[dateKey].campaigns[stat.campaign_id].total += stat.total;
                    dayStats[dateKey].campaigns[stat.campaign_id].completed += stat.completed;
                }

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
                        order_taken: 0,
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
                callerStat.order_taken += stat.order_taken;
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
        const { start_date, days = 7, regions, cities, append = false, caller_ids, campaign_name } = await request.json();

        if (!start_date) {
            return NextResponse.json(
                { error: 'start_date is required' },
                { status: 400 }
            );
        }

        // Calculate end date for campaign
        const end_date = format(addDays(new Date(start_date), days - 1), 'yyyy-MM-dd');

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

        // Build location filter - handle virtual regions
        let locationFilter = '';
        const locationParams: (string | number)[] = [];

        // Check for virtual regions
        const virtualUserIds: string[] = [];
        let isImplantsRegion = false;
        const geoRegions: string[] = [];

        if (regions && regions.length > 0) {
            for (const region of regions) {
                if (region.startsWith('★ Клиенти ')) {
                    // Extract username from virtual region name
                    const username = region.replace('★ Клиенти ', '').trim();
                    // Look up by display_name first, then username
                    const targetUser = db.prepare(`
                        SELECT id FROM users 
                        WHERE display_name = ? OR username = ?
                    `).get(username, username) as { id: string } | undefined;
                    if (targetUser) {
                        virtualUserIds.push(targetUser.id);
                    }
                } else if (region === '🦷 Импланти') {
                    isImplantsRegion = true;
                } else {
                    geoRegions.push(region);
                }
            }
        }

        // Build combined filter using OR logic for multiple region types
        const regionConditions: string[] = [];

        // Add virtual user regions (preferred_caller_id = user_id)
        if (virtualUserIds.length > 0) {
            // Validate that the selected callers include ALL selected user regions
            if (caller_ids && caller_ids.length > 0) {
                const missingCallers = virtualUserIds.filter(id => !caller_ids.includes(id));
                if (missingCallers.length > 0) {
                    // Get the names of missing callers
                    const missingNames = db.prepare(`
                        SELECT COALESCE(display_name, username) as name FROM users WHERE id IN (${missingCallers.map(() => '?').join(',')})
                    `).all(...missingCallers) as { name: string }[];
                    return NextResponse.json({
                        success: false,
                        error: `Несъвместимост: регионите "★ Клиенти" изискват съответните обаждащи се да бъдат избрани: ${missingNames.map(n => n.name).join(', ')}`,
                    }, { status: 400 });
                }
            }
            regionConditions.push(`d.preferred_caller_id IN (${virtualUserIds.map(() => '?').join(',')})`);
            locationParams.push(...virtualUserIds);
        }

        // Add implants region
        if (isImplantsRegion) {
            // For implants, include dentists who want implants AND don't have a preferred caller
            // (unless that caller is also in virtualUserIds)
            if (virtualUserIds.length > 0) {
                regionConditions.push(`(d.wants_implants = 1 AND (d.preferred_caller_id IS NULL OR d.preferred_caller_id IN (${virtualUserIds.map(() => '?').join(',')})))`);
                locationParams.push(...virtualUserIds);
            } else {
                regionConditions.push(`(d.wants_implants = 1 AND d.preferred_caller_id IS NULL)`);
            }
        }

        // Add geographic regions
        if (geoRegions.length > 0) {
            // For geographic regions, include dentists in those regions who don't have a preferred caller
            // (unless that caller is also in virtualUserIds which means we explicitly selected them)
            if (virtualUserIds.length > 0) {
                regionConditions.push(`(d.region IN (${geoRegions.map(() => '?').join(',')}) AND (d.preferred_caller_id IS NULL OR d.preferred_caller_id IN (${virtualUserIds.map(() => '?').join(',')})))`);
                locationParams.push(...geoRegions, ...virtualUserIds);
            } else {
                regionConditions.push(`(d.region IN (${geoRegions.map(() => '?').join(',')}) AND d.preferred_caller_id IS NULL)`);
                locationParams.push(...geoRegions);
            }
        }

        // Combine all conditions with OR
        if (regionConditions.length > 0) {
            locationFilter = ` AND (${regionConditions.join(' OR ')})`;
        }

        if (cities && cities.length > 0) {
            // Filter by cities_served containing any of the specified cities
            const cityConditions = cities.map(() => `d.cities_served LIKE ?`).join(' OR ');
            locationFilter += ` AND (${cityConditions})`;
            locationParams.push(...cities.map((c: string) => `%${c}%`));
        }

        // Get dentists with smart prioritization
        const dentists = db.prepare(`
      SELECT d.id, d.region, d.cities_served, d.preferred_caller_id,
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
            preferred_caller_id: string | null;
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
        // Only delete assignments that match the current filter criteria
        if (!append) {
            let deleteQuery = `
                DELETE FROM assignments 
                WHERE DATE(date) >= ? AND DATE(date) < ?
            `;
            const deleteParams: string[] = [start_date, format(addDays(new Date(start_date), days), 'yyyy-MM-dd')];

            // If specific callers selected, only delete their assignments
            if (caller_ids && caller_ids.length > 0) {
                deleteQuery += ` AND caller_id IN (${caller_ids.map(() => '?').join(',')})`;
                deleteParams.push(...caller_ids);
            }

            // If specific regions/cities selected, only delete assignments for dentists in those areas
            if ((regions && regions.length > 0) || (cities && cities.length > 0)) {
                let dentistFilter = '';
                const dentistParams: string[] = [];

                if (regions && regions.length > 0) {
                    dentistFilter += `region IN (${regions.map(() => '?').join(',')})`;
                    dentistParams.push(...regions);
                }

                if (cities && cities.length > 0) {
                    const cityConditions = cities.map(() => `cities_served LIKE ?`).join(' OR ');
                    if (dentistFilter) dentistFilter += ' AND ';
                    dentistFilter += `(${cityConditions})`;
                    dentistParams.push(...cities.map((c: string) => `%${c}%`));
                }

                deleteQuery += ` AND dentist_id IN (SELECT id FROM dentists WHERE ${dentistFilter})`;
                deleteParams.push(...dentistParams);
            }

            db.prepare(deleteQuery).run(...deleteParams);
        }

        // Create campaign record
        const campaignId = generateId();
        const campaignDisplayName = campaign_name || `Campaign ${start_date}${start_date !== end_date ? ` - ${end_date}` : ''}`;

        db.prepare(`
            INSERT INTO campaigns (id, name, start_date, end_date, target_regions, target_cities, target_callers, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `).run(
            campaignId,
            campaignDisplayName,
            start_date,
            end_date,
            regions && regions.length > 0 ? JSON.stringify(regions) : null,
            cities && cities.length > 0 ? JSON.stringify(cities) : null,
            caller_ids && caller_ids.length > 0 ? JSON.stringify(caller_ids) : null
        );

        // Separate dentists into pools
        // commonPool: Dentists with no preference
        // preferredPools: Map of caller_id -> list of dentists
        const commonPool = dentists.filter(d => !d.preferred_caller_id);
        const preferredPools = new Map<string, typeof dentists>();

        // Initialize pools for all active callers
        callers.forEach(c => preferredPools.set(c.id, []));

        // Fill preferred pools
        dentists.filter(d => d.preferred_caller_id).forEach(d => {
            if (preferredPools.has(d.preferred_caller_id!)) {
                preferredPools.get(d.preferred_caller_id!)!.push(d);
            }
            // If preferred caller is not in the active list, this dentist is effectively skipped
            // which is correct (reserved for someone else)
        });

        // Initialize indices
        let commonIndex = 0;
        const preferredIndices = new Map<string, number>();
        callers.forEach(c => preferredIndices.set(c.id, 0));

        let assignmentCount = 0;
        const usedDentistIds = new Set<string>();

        const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO assignments (id, date, dentist_id, caller_id, campaign_id)
      VALUES (?, ?, ?, ?, ?)
    `);

        const insertMany = db.transaction(() => {
            for (let day = 0; day < days; day++) {
                const currentDate = format(addDays(new Date(start_date), day), 'yyyy-MM-dd');

                for (const caller of callers) {
                    for (let i = 0; i < caller.daily_target; i++) {
                        let dentistToAssign = null;

                        // 1. Try to get from preferred pool
                        const callerPool = preferredPools.get(caller.id) || [];
                        let pIndex = preferredIndices.get(caller.id) || 0;

                        // Find next unused preferred dentist
                        // Note: dentists are already sorted by priority from the query
                        while (pIndex < callerPool.length) {
                            const candidate = callerPool[pIndex];
                            if (!usedDentistIds.has(candidate.id)) {
                                dentistToAssign = candidate;
                                preferredIndices.set(caller.id, pIndex + 1);
                                break;
                            }
                            pIndex++;
                        }
                        preferredIndices.set(caller.id, pIndex); // Update index if we just skipped used ones

                        // 2. If no preferred, get from common pool
                        if (!dentistToAssign) {
                            while (commonIndex < commonPool.length) {
                                const candidate = commonPool[commonIndex];
                                if (!usedDentistIds.has(candidate.id)) {
                                    dentistToAssign = candidate;
                                    commonIndex++; // We can increment here because this is a shared linear scan
                                    break;
                                }
                                commonIndex++;
                            }
                        }

                        if (!dentistToAssign) {
                            // No more dentists available for this caller
                            continue;
                        }

                        usedDentistIds.add(dentistToAssign.id);

                        insertStmt.run(
                            generateId(),
                            currentDate,
                            dentistToAssign.id,
                            caller.id,
                            campaignId
                        );

                        assignmentCount++;
                    }
                }
            }
        });

        insertMany();

        // Get region breakdown for response
        const regionBreakdown: Record<string, number> = {};
        // Use usedDentistIds to calculate breakdown
        dentists.forEach(d => {
            if (usedDentistIds.has(d.id)) {
                regionBreakdown[d.region] = (regionBreakdown[d.region] || 0) + 1;
            }
        });

        return NextResponse.json({
            success: true,
            message: `Generated ${assignmentCount} assignments for ${days} days`,
            total_assignments: assignmentCount,
            available_dentists: dentists.length,
            region_breakdown: regionBreakdown,
            callers_assigned: callers.map(c => c.username),
            campaign: {
                id: campaignId,
                name: campaignDisplayName
            }
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
        logger.debug('Assignments', 'DELETE Unauthorized');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const region = searchParams.get('region');

    logger.debug('Assignments', `DELETE Params: date=${date}, start=${startDate}, end=${endDate}, region=${region}`);

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
    logger.debug('Assignments', `Found ${beforeCount.count} to delete`);

    const result = db.prepare(`DELETE FROM assignments WHERE ${whereClause}`).run(...params);
    logger.debug('Assignments', `Deleted ${result.changes}`);

    return NextResponse.json({
        success: true,
        deleted: result.changes
    });
}

// Update assignment (e.g. save notes)
export async function PATCH(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, notes } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
        }

        // Verify ownership (or admin)
        const assignment = db.prepare('SELECT caller_id FROM assignments WHERE id = ?').get(id) as { caller_id: string } | undefined;

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (session.role !== 'ADMIN' && assignment.caller_id !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        db.prepare('UPDATE assignments SET notes = ? WHERE id = ?').run(notes, id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update assignment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
