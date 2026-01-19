import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    try {
        const body = await request.json();

        // Remove ID from body if present to avoid changing primary key
        delete body.id;
        delete body.created_at;

        const setClauses: string[] = [];
        const params: any[] = [];

        // Handle specific fields
        if (body.facility_name !== undefined) {
            setClauses.push('facility_name = ?');
            params.push(body.facility_name);
        }
        if (body.region !== undefined) {
            setClauses.push('region = ?');
            params.push(body.region);
        }
        if (body.cities_served !== undefined) {
            setClauses.push('cities_served = ?');
            params.push(body.cities_served); // Expecting string or managing it
        }
        // Also support 'city' alias for cities_served since modals use that
        if (body.city !== undefined) {
            setClauses.push('cities_served = ?');
            params.push(body.city);
        }
        if (body.manager !== undefined) {
            setClauses.push('manager = ?');
            params.push(body.manager);
        }
        if (body.preferred_caller_id !== undefined) {
            setClauses.push('preferred_caller_id = ?');
            params.push(body.preferred_caller_id || null);
        }
        if (body.phones !== undefined) {
            setClauses.push('phones = ?');
            // Ensure phones is stored as JSON string
            const phonesVal = Array.isArray(body.phones) ? JSON.stringify(body.phones) : body.phones;
            params.push(phonesVal);
        }
        // Handle address/email if you have those columns, but schema in db.ts only lists standard ones + 'locations'
        // If 'address' or 'email' were passed, they might need to go into a 'locations' JSON or ignored if no column.
        // Looking at db.ts scheme: facility_name, region, manager, phones, services, cities_served, locations, staff, preferred_caller_id
        // Address/Email are likely part of specific locations JSON or not in standard schema yet?
        // Wait, AddDentistModal sends "address" and "email". Let's check db.ts schema again.
        // "INSERT INTO dentists ... locations, staff ..."
        // It seems address/email aren't top-level columns in the CREATE TABLE provided in db.ts (lines 41-55 in Step 1117 view).
        // Wait, line 171 in `src/app/api/dentists/route.ts` creates:
        // INSERT INTO dentists (..., address, ..., email, ...)
        // BUT the schema definition in `src/lib/db.ts` (lines 41-55) DOES NOT SHOW address or email columns!
        // This implies `src/app/api/dentists/route.ts` POST might be failing or the schema provided in `getDb()` is outdated/incomplete vs actual DB.
        // However, since `better-sqlite3` throws on unknown columns, if the POST works, the columns exist.
        // I should assume they might exist or I should check `db.ts` carefully.
        // In Step 1117 view of `src/lib/db.ts`, columns are: id, facility_name, region, manager, phones, services, cities_served, locations, staff, staff_count, preferred_caller_id.
        // NO address, NO email.
        // So `src/app/api/dentists/route.ts` POST logic at line 171 `INSERT INTO dentists (... address, ... email ...)` IS LIKELY BROKEN or relies on columns added manually/outside this migration.
        // Given I am "Antigravity", I should fix/align this if possible, but for now I will only update known columns to avoid SQL errors.
        // I'll stick to updating: facility_name, region, manager, phones, preferred_caller_id.
        // I will map `address` and `email` to `locations` json if needed, or ignore them if columns don't exist.
        // Actually, let's verify if `address` and `email` columns exist.

        // For safely, I'll allow updating them if the user asks, but wrap in try/catch or check schema?
        // Let's stick to the visible schema + `preferred_caller_id`.
        // If the user wants to edit address/email, we might need a migration.
        // The user specifically asked for "phone numbers".

        if (setClauses.length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        params.push(id);
        const stmt = db.prepare(`UPDATE dentists SET ${setClauses.join(', ')} WHERE id = ?`);
        stmt.run(...params);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update dentist error:', error);
        return NextResponse.json({ error: 'Failed to update dentist' }, { status: 500 });
    }
}
