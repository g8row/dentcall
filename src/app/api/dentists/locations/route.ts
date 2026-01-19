import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

interface CityStat {
    name: string;
    count: number;
    available: number;
}

// Get hierarchical location data with counts
export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const municipality = searchParams.get('municipality');

    // If no filters, return all regions with counts
    if (!region) {
        const regions = db.prepare(`
      SELECT 
        region,
        COUNT(*) as dentist_count,
        COUNT(DISTINCT cities_served) as city_count
      FROM dentists 
      GROUP BY region 
      ORDER BY region
    `).all() as { region: string; dentist_count: number; city_count: number }[];

        return NextResponse.json({ regions });
    }

    // If region specified, get cities with counts
    if (region && !municipality) {
        // Get caller mapping
        const users = db.prepare("SELECT id, username FROM users WHERE role = 'CALLER'").all() as { id: string; username: string }[];
        const callerMap = new Map(users.map(u => [u.id, u.username]));

        // Get all dentists in region
        const dentists = db.prepare(`
      SELECT id, locations, cities_served, preferred_caller_id
      FROM dentists 
      WHERE region = ?
    `).all(region) as { id: string; locations: string; cities_served: string; preferred_caller_id: string | null }[];

        // Get unavailable dentist IDs (interested, rejected)
        const unavailable = new Set(
            (db.prepare(`
        SELECT DISTINCT dentist_id 
        FROM calls 
        WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
      `).all() as { dentist_id: string }[]).map(r => r.dentist_id)
        );

        const cityStats = new Map<string, { count: number; available: number; preferred: Record<string, number> }>();

        for (const d of dentists) {
            const isAvailable = !unavailable.has(d.id);
            const dentistCities = new Set<string>();

            // Extract from locations JSON
            try {
                if (d.locations) {
                    const locs = JSON.parse(d.locations);
                    for (const loc of locs) {
                        if (loc.city) dentistCities.add(loc.city.trim());
                    }
                }
            } catch (e) { }

            // Extract from cities_served (JSON or String)
            if (d.cities_served) {
                try {
                    // Try JSON first
                    const parsed = JSON.parse(d.cities_served);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(c => {
                            if (typeof c === 'string' && c.trim()) dentistCities.add(c.trim());
                        });
                    }
                } catch {
                    // Fallback to legacy semicolon split
                    d.cities_served.split(';').forEach(c => {
                        const city = c.trim();
                        if (city) dentistCities.add(city);
                    });
                }
            }

            // Increment counts
            for (const city of dentistCities) {
                const stat = cityStats.get(city) || { count: 0, available: 0, preferred: {} };
                stat.count++;
                if (isAvailable) {
                    stat.available++;

                    if (d.preferred_caller_id) {
                        const callerName = callerMap.get(d.preferred_caller_id);
                        if (callerName) {
                            stat.preferred[callerName] = (stat.preferred[callerName] || 0) + 1;
                        }
                    }
                }
                cityStats.set(city, stat);
            }
        }

        const cities = Array.from(cityStats.entries())
            .map(([name, stat]) => ({ name, ...stat }))
            .filter(c => c.name.length > 1 && !c.name.includes('[')) // Extra safety filter
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ cities });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
