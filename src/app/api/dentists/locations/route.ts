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
        // Get all dentists in region
        const dentists = db.prepare(`
      SELECT id, locations, cities_served
      FROM dentists 
      WHERE region = ?
    `).all(region) as { id: string; locations: string; cities_served: string }[];

        // Get unavailable dentist IDs (interested, rejected)
        const unavailable = new Set(
            (db.prepare(`
        SELECT DISTINCT dentist_id 
        FROM calls 
        WHERE outcome IN ('INTERESTED', 'NOT_INTERESTED')
      `).all() as { dentist_id: string }[]).map(r => r.dentist_id)
        );

        const cityStats = new Map<string, { count: number; available: number }>();

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

            // Extract from cities_served
            if (d.cities_served) {
                d.cities_served.split(';').forEach(c => {
                    const city = c.trim();
                    if (city) dentistCities.add(city);
                });
            }

            // Increment counts
            for (const city of dentistCities) {
                const stat = cityStats.get(city) || { count: 0, available: 0 };
                stat.count++;
                if (isAvailable) stat.available++;
                cityStats.set(city, stat);
            }
        }

        const cities: CityStat[] = Array.from(cityStats.entries())
            .map(([name, stat]) => ({ name, ...stat }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ cities });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
