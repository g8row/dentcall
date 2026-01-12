import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const { newPassword, confirmPassword } = await request.json();

        if (!newPassword || !confirmPassword) {
            return NextResponse.json(
                { error: 'Both password fields are required' },
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                { error: 'Passwords do not match' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        const hashedPassword = await hashPassword(newPassword);

        db.prepare(`
            UPDATE users 
            SET password = ?, must_reset_password = 0 
            WHERE id = ?
        `).run(hashedPassword, session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
