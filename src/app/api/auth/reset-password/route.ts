import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';
import { validateBody, resetPasswordSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Validate request body with Zod
        const validation = await validateBody(request, resetPasswordSchema);
        if (!validation.success) {
            return validation.response;
        }
        const { newPassword } = validation.data;

        const hashedPassword = await hashPassword(newPassword);

        db.prepare(`
            UPDATE users 
            SET password = ?, must_reset_password = 0 
            WHERE id = ?
        `).run(hashedPassword, session.user.id);

        logger.info('Auth', `Password reset for user: ${session.user.username}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Auth', 'Reset password error', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

