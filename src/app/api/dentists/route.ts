import { NextRequest, NextResponse } from 'next/server';
import db, { Dentist } from '@/lib/db';
import { getSession, generateId } from '@/lib/auth';

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

// Update dentist - allows callers to add phone numbers and toggle implants
export async function PATCH(request: NextRequest) {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { dentist_id, add_phone, wants_implants } = body;

        if (!dentist_id) {
            return NextResponse.json({ error: 'dentist_id is required' }, { status: 400 });
        }

        // Get current dentist
        const dentist = db.prepare(`SELECT * FROM dentists WHERE id = ?`).get(dentist_id) as Dentist | undefined;
        if (!dentist) {
            return NextResponse.json({ error: 'Dentist not found' }, { status: 404 });
        }

        // Handle wants_implants toggle
        if (typeof wants_implants === 'boolean' || typeof wants_implants === 'number') {
            const value = wants_implants ? 1 : 0;
            // Format date as YYYY-MM-DD HH:mm:ss for SQLite consistency
            const now = new Date();
            const updated = now.toISOString().replace('T', ' ').split('.')[0];

            // Update dentist
            db.prepare(`UPDATE dentists SET wants_implants = ? WHERE id = ?`).run(value, dentist_id);

            // Log change to call history
            // We use a special outcome "SYSTEM" or just a note
            // But user wants it exported, so let's log it as a call with outcome "IMPLANTS_CHANGED"?
            // Or better, reuse existing structure. Let's create a call entry with a specific note.
            // Actually, "wants_implants" is a persistent state.
            // Let's use a custom outcome or just a note if the user just wants the regular log.
            // "create a seperate entry in the call log that gets exported"
            // Let's use outcome "OTHER" or similar, but the export handles translations.
            // Let's assume we can add a new outcome or reuse one. 
            // Since there isn't a "SYSTEM" outcome in the types usually, let's check outcomes.
            // The export translation map has: INTERESTED, NOT_INTERESTED, NO_ANSWER, CALLBACK, ORDER_TAKEN.
            // Let's insert it as "INTERESTED" if enabled? No that messes up stats.
            // Let's add a note to a "NO_ANSWER" or just insert with a custom outcome and handle export?
            // The best way is to add a new outcome type "IMPLANT_CHANGE" and handle it in export.

            // For now, let's insert it with outcome 'IMPLANT_CHANGE' and make sure export handles it.
            const callId = generateId();
            const note = value ? 'Enabled implants' : 'Disabled implants';
            const logOutcome = value ? 'IMPLANT_INTERESTED' : 'IMPLANT_NOT_INTERESTED'; // specialized outcomes?

            // Let's stick to a generic outcome but specific note so export is clear.
            // Wait, export translates precise strings.
            // If I add a new outcome 'IMPLANT_STATUS', I need to update export.
            // Let's use 'IMPLANT_STATUS' as outcome.

            db.prepare(`
                INSERT INTO calls (id, dentist_id, caller_id, outcome, notes, called_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                callId,
                dentist_id,
                session.user.id,
                'IMPLANT_STATUS',
                note,
                updated
            );

            return NextResponse.json({
                success: true,
                message: value ? 'Implant flag enabled' : 'Implant flag disabled',
                wants_implants: value,
            });
        }

        // Handle adding a phone number
        if (add_phone) {
            const cleanPhone = add_phone.trim();
            if (!cleanPhone) {
                return NextResponse.json({ error: 'Phone number cannot be empty' }, { status: 400 });
            }

            // Parse existing phones and add new one
            const phones: string[] = JSON.parse(dentist.phones || '[]');

            // Check if phone already exists
            if (phones.includes(cleanPhone)) {
                return NextResponse.json({ error: 'Phone number already exists' }, { status: 400 });
            }

            phones.push(cleanPhone);

            // Update dentist
            db.prepare(`UPDATE dentists SET phones = ? WHERE id = ?`).run(JSON.stringify(phones), dentist_id);

            return NextResponse.json({
                success: true,
                message: 'Phone number added',
                phones,
            });
        }

        return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    } catch (error) {
        console.error('Update dentist error:', error);
        return NextResponse.json({ error: 'Failed to update dentist' }, { status: 500 });
    }
}

// Create new dentist
export async function POST(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { facility_name, region, city, address, manager, phone, email, eik, preferred_caller_id } = await request.json();

        // Validation
        if (!facility_name || !region || !city || !phone) {
            return NextResponse.json(
                { error: 'Missing required fields: Name, Region, City, and Phone are required.' },
                { status: 400 }
            );
        }

        // Check duplicate
        const existing = db.prepare(`
            SELECT id FROM dentists 
            WHERE facility_name = ? AND region = ? AND cities_served LIKE ?
        `).get(facility_name, region, `%${city}%`);

        if (existing) {
            return NextResponse.json(
                { error: 'A dentist with this name in this region/city already exists.' },
                { status: 400 }
            );
        }

        const id = generateId();
        const phones = JSON.stringify([phone]);

        // Store address in locations JSON since address/email columns don't exist in schema
        const locations = address ? JSON.stringify([{ city, address }]) : JSON.stringify([{ city }]);

        db.prepare(`
            INSERT INTO dentists (id, facility_name, region, cities_served, locations, manager, phones, eik, preferred_caller_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, facility_name, region, city, locations, manager || null, phones, eik || null, preferred_caller_id || null);

        return NextResponse.json({
            success: true,
            message: 'Dentist added successfully',
            dentist: {
                id, facility_name, region, cities_served: city, phones, eik
            }
        });

    } catch (error) {
        console.error('Create dentist error:', error);
        return NextResponse.json({ error: 'Failed to create dentist' }, { status: 500 });
    }
}
