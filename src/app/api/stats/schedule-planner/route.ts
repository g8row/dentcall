import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

interface RegionStats {
  region: string;
  total_dentists: number;
  called_dentists: number;
  coverage_percent: number;
  interested: number;
  not_interested: number;
  no_answer: number;
  callbacks_pending: number;
  interest_rate: number;
  last_called: string | null;
  days_since_last: number | null;
  priority_score: number;
  available_dentists: number;
  preferred_available: number;
}

// Get detailed region stats for schedule planning
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const excludeDays = parseInt(searchParams.get('exclude_days') || '0');

  // Get comprehensive stats per region
  const stats = db.prepare(`
    WITH region_calls AS (
      SELECT 
        d.region,
        d.id as dentist_id,
        c.id as call_id,
        c.outcome,
        c.called_at,
        ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY c.called_at DESC) as rn
      FROM dentists d
      LEFT JOIN calls c ON d.id = c.dentist_id
    ),
    region_summary AS (
      SELECT 
        d.region,
        COUNT(DISTINCT d.id) as total_dentists,
        COUNT(DISTINCT CASE WHEN rc.call_id IS NOT NULL THEN d.id END) as called_dentists,
        SUM(CASE WHEN rc.outcome = 'INTERESTED' AND rc.rn = 1 THEN 1 ELSE 0 END) as interested,
        SUM(CASE WHEN rc.outcome = 'NOT_INTERESTED' AND rc.rn = 1 THEN 1 ELSE 0 END) as not_interested,
        SUM(CASE WHEN rc.outcome = 'NO_ANSWER' AND rc.rn = 1 THEN 1 ELSE 0 END) as no_answer,
        SUM(CASE WHEN rc.outcome = 'CALLBACK' AND rc.rn = 1 THEN 1 ELSE 0 END) as callbacks_pending,
        MAX(rc.called_at) as last_called
      FROM dentists d
      LEFT JOIN region_calls rc ON d.id = rc.dentist_id AND rc.rn = 1
      GROUP BY d.region
    )
    SELECT 
      rs.*,
      -- Available = not interested, not rejected, not called recently
      (SELECT COUNT(*) FROM dentists d2 
       WHERE d2.region = rs.region 
       AND d2.id NOT IN (
         SELECT dentist_id FROM calls 
         WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
       )
       ${excludeDays > 0 ? `AND d2.id NOT IN (
         SELECT dentist_id FROM calls 
         WHERE DATE(called_at) > DATE('now', '-${excludeDays} days')
       )` : ''}
      ) as available_dentists,
      (SELECT COUNT(*) FROM dentists d3 
       WHERE d3.region = rs.region 
       AND d3.preferred_caller_id IS NOT NULL
       AND d3.id NOT IN (
         SELECT dentist_id FROM calls 
         WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
       )
       ${excludeDays > 0 ? `AND d3.id NOT IN (
         SELECT dentist_id FROM calls 
         WHERE DATE(called_at) > DATE('now', '-${excludeDays} days')
       )` : ''}
      ) as preferred_available
    FROM region_summary rs
    ORDER BY rs.region
  `).all() as Array<{
    region: string;
    total_dentists: number;
    called_dentists: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callbacks_pending: number;
    last_called: string | null;
    available_dentists: number;
    preferred_available: number;
  }>;

  const now = new Date();

  const enrichedStats: RegionStats[] = stats.map(s => {
    const coverage_percent = s.total_dentists > 0
      ? Math.round((s.called_dentists / s.total_dentists) * 100)
      : 0;

    const total_calls = s.interested + s.not_interested + s.no_answer + s.callbacks_pending;
    const interest_rate = total_calls > 0
      ? Math.round((s.interested / total_calls) * 100)
      : 0;

    let days_since_last: number | null = null;
    if (s.last_called) {
      const lastDate = new Date(s.last_called);
      days_since_last = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Priority score formula:
    // - High available dentists = high priority
    // - High callbacks = high priority  
    // - Days since last call * 2 = moderate priority
    // - Low coverage = high priority
    const priority_score =
      s.available_dentists +
      (s.callbacks_pending * 10) +
      ((days_since_last || 365) * 2) +
      ((100 - coverage_percent) * 2);

    return {
      ...s,
      coverage_percent,
      interest_rate,
      days_since_last,
      priority_score,
    };
  });

  // Generate smart suggestions
  const suggestions = {
    hot_picks: enrichedStats
      .filter(s => s.interest_rate > 20 && s.available_dentists > 10)
      .sort((a, b) => b.interest_rate - a.interest_rate)
      .slice(0, 3)
      .map(s => s.region),

    quick_wins: enrichedStats
      .filter(s => s.total_dentists < 50 && s.coverage_percent < 50)
      .sort((a, b) => a.total_dentists - b.total_dentists)
      .slice(0, 3)
      .map(s => s.region),

    callbacks_pending: enrichedStats
      .filter(s => s.callbacks_pending > 0)
      .sort((a, b) => b.callbacks_pending - a.callbacks_pending)
      .slice(0, 3)
      .map(s => s.region),

    reengage: enrichedStats
      .filter(s => (s.days_since_last || 0) > 30 && s.available_dentists > 0)
      .sort((a, b) => (b.days_since_last || 0) - (a.days_since_last || 0))
      .slice(0, 3)
      .map(s => s.region),

    highest_priority: enrichedStats
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 5)
      .map(s => s.region),
  };

  // Calculate preferred breakdown per caller
  const preferredBreakdown = db.prepare(`
    SELECT 
      d.region,
      u.username,
      COUNT(*) as count
    FROM dentists d
    JOIN users u ON d.preferred_caller_id = u.id
    WHERE d.id NOT IN (
      SELECT dentist_id FROM calls 
      WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
    )
    ${excludeDays > 0 ? `AND d.id NOT IN (
      SELECT dentist_id FROM calls 
      WHERE DATE(called_at) > DATE('now', '-${excludeDays} days')
    )` : ''}
    GROUP BY d.region, u.username
  `).all() as { region: string; username: string; count: number }[];

  const callers = db.prepare(`
    SELECT id, username, daily_target 
    FROM users 
    WHERE role = 'CALLER' AND daily_target > 0
  `).all() as { id: string; username: string; daily_target: number }[];

  const totalDailyCapacity = callers.reduce((sum, c) => sum + c.daily_target, 0);

  // Build virtual regions for users with preferred doctors
  const userRegions: RegionStats[] = [];

  for (const caller of callers) {
    // Get available dentists for this caller (preferred_caller_id = caller.id)
    const userDentists = db.prepare(`
      SELECT COUNT(*) as count
      FROM dentists d
      WHERE d.preferred_caller_id = ?
      AND d.id NOT IN (
        SELECT dentist_id FROM calls 
        WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
      )
      ${excludeDays > 0 ? `AND d.id NOT IN (
        SELECT dentist_id FROM calls 
        WHERE DATE(called_at) > DATE('now', '-${excludeDays} days')
      )` : ''}
    `).get(caller.id) as { count: number };

    if (userDentists.count > 0) {
      userRegions.push({
        region: `★ Клиенти ${caller.username}`,
        total_dentists: userDentists.count,
        called_dentists: 0,
        coverage_percent: 0,
        interested: 0,
        not_interested: 0,
        no_answer: 0,
        callbacks_pending: 0,
        interest_rate: 0,
        last_called: null,
        days_since_last: null,
        priority_score: 9999, // Very high priority
        available_dentists: userDentists.count,
        preferred_available: userDentists.count,
      });
    }
  }

  // Build Implants virtual region (doctors with wants_implants = 1)
  const implantDentists = db.prepare(`
    SELECT COUNT(*) as count
    FROM dentists d
    WHERE d.wants_implants = 1
    AND d.id NOT IN (
      SELECT dentist_id FROM calls 
      WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
    )
    ${excludeDays > 0 ? `AND d.id NOT IN (
      SELECT dentist_id FROM calls 
      WHERE DATE(called_at) > DATE('now', '-${excludeDays} days')
    )` : ''}
  `).get() as { count: number };

  const implantsRegion: RegionStats | null = implantDentists.count > 0 ? {
    region: '🦷 Импланти',
    total_dentists: implantDentists.count,
    called_dentists: 0,
    coverage_percent: 0,
    interested: 0,
    not_interested: 0,
    no_answer: 0,
    callbacks_pending: 0,
    interest_rate: 0,
    last_called: null,
    days_since_last: null,
    priority_score: 8888, // High priority
    available_dentists: implantDentists.count,
    preferred_available: 0,
  } : null;

  // Adjust geographic region counts by subtracting preferred doctors
  const adjustedStats = enrichedStats.map(s => {
    // Subtract preferred doctors from the available count for this region
    const preferredInRegion = preferredBreakdown
      .filter(p => p.region === s.region)
      .reduce((sum, p) => sum + p.count, 0);

    return {
      ...s,
      available_dentists: Math.max(0, s.available_dentists - preferredInRegion),
      preferred_breakdown: preferredBreakdown
        .filter(p => p.region === s.region)
        .reduce((acc, curr) => ({ ...acc, [curr.username]: curr.count }), {} as Record<string, number>)
    };
  });

  // Combine all regions: user regions first, then implants, then geographic
  const allRegions = [
    ...userRegions,
    ...(implantsRegion ? [implantsRegion] : []),
    ...adjustedStats,
  ];

  return NextResponse.json({
    regions: allRegions,
    suggestions,
    callers,
    totalDailyCapacity,
    summary: {
      total_dentists: enrichedStats.reduce((sum, s) => sum + s.total_dentists, 0),
      total_available: enrichedStats.reduce((sum, s) => sum + s.available_dentists, 0),
      total_callbacks: enrichedStats.reduce((sum, s) => sum + s.callbacks_pending, 0),
    }
  });
}
