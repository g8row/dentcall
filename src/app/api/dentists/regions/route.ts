import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// Get unique regions
export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const regions = db.prepare(`
    SELECT DISTINCT region FROM dentists ORDER BY region
  `).all() as { region: string }[];

    return NextResponse.json({ regions: regions.map(r => r.region) });
}
