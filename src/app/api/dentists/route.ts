import { NextRequest, NextResponse } from 'next/server';
import db, { Dentist } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Get dentists with pagination and filters
export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const region = searchParams.get('region');
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: (string | number)[] = [];

    if (region) {
        whereClause += ' AND region = ?';
        params.push(region);
    }

    if (city) {
        whereClause += ' AND cities_served LIKE ?';
        params.push(`%${city}%`);
    }

    if (search) {
        whereClause += ' AND (facility_name LIKE ? OR manager LIKE ? OR phones LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM dentists WHERE ${whereClause}`).get(...params) as { total: number };

    const dentists = db.prepare(`
    SELECT * FROM dentists 
    WHERE ${whereClause}
    ORDER BY region, facility_name
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Dentist[];

    // Get last call for each dentist
    const dentistIds = dentists.map(d => d.id);
    const lastCalls = dentistIds.length > 0
        ? db.prepare(`
        SELECT dentist_id, outcome, called_at, notes
        FROM calls
        WHERE dentist_id IN (${dentistIds.map(() => '?').join(',')})
        AND called_at = (
          SELECT MAX(called_at) FROM calls c2 WHERE c2.dentist_id = calls.dentist_id
        )
      `).all(...dentistIds) as { dentist_id: string; outcome: string; called_at: string; notes: string }[]
        : [];

    const lastCallMap = new Map(lastCalls.map(c => [c.dentist_id, c]));

    const enrichedDentists = dentists.map(d => ({
        ...d,
        phones: JSON.parse(d.phones || '[]'),
        last_call: lastCallMap.get(d.id) || null,
    }));

    return NextResponse.json({
        dentists: enrichedDentists,
        pagination: {
            page,
            limit,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / limit),
        },
    });
}
