import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
        }

        if (userId === session.user.id) {
            return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Generate deactivated credentials
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const deactivatedUsername = `inactive_${timestamp}_${user.username}`;
        // Preserve original username in display name if possible, or use current display name
        const oldName = user.display_name || user.username;
        const deactivatedDisplayName = `(Inactive) ${oldName}`;
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await hashPassword(randomPassword);

        // Transaction to update user and clear assignments
        const deactivate = db.transaction(() => {
            // 1. Scramble credentials
            db.prepare(`
                UPDATE users 
                SET username = ?, 
                    display_name = ?, 
                    password = ?, 
                    daily_target = 0 
                WHERE id = ?
            `).run(deactivatedUsername, deactivatedDisplayName, hashedPassword, userId);

            // 2. Unassign from all future assignments
            db.prepare(`
                DELETE FROM assignments 
                WHERE caller_id = ? AND date >= DATE('now')
            `).run(userId);

            // 3. Unassign from dentists
            db.prepare(`
                UPDATE dentists 
                SET preferred_caller_id = NULL 
                WHERE preferred_caller_id = ?
            `).run(userId);
        });

        deactivate();

        return NextResponse.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('Deactivate user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
