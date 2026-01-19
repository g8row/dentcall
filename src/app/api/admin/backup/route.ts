import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs';
import { performServerBackup } from '@/lib/backup';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

        if (mode === 'server') {
            // Server-side backup (copy to data/backups)
            const result = performServerBackup();
            if (result.success) {
                return NextResponse.json({
                    success: true,
                    message: 'Backup created successfully',
                    filename: result.path
                });
            } else {
                return NextResponse.json({ error: result.error || 'Backup failed' }, { status: 500 });
            }
        } else {
            // Client download (stream file)
            const dbPath = path.join(process.cwd(), 'data', 'cold-caller.db');

            if (!fs.existsSync(dbPath)) {
                return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
            }

            const stats = fs.statSync(dbPath);
            const fileStream = fs.createReadStream(dbPath);

            // Return file as stream
            return new NextResponse(fileStream as any, {
                headers: {
                    'Content-Type': 'application/x-sqlite3',
                    'Content-Disposition': `attachment; filename="cold-caller-backup-${new Date().toISOString()}.db"`,
                    'Content-Length': stats.size.toString(),
                },
            });
        }

    } catch (error) {
        console.error('Backup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
