import { NextRequest, NextResponse } from 'next/server';
import db, { User } from '@/lib/db';
import { verifyPassword, createToken, setAuthCookie, ensureAdminExists } from '@/lib/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validateBody, loginSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        // Rate limiting: 5 login attempts per 15 minutes per IP
        const clientIp = getClientIp(request.headers);
        const rateLimit = checkRateLimit(`login:${clientIp}`, RATE_LIMITS.LOGIN);

        if (!rateLimit.success) {
            logger.warn('Auth', `Rate limit exceeded for IP: ${clientIp}`);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Too many login attempts. Please try again later.',
                    retryAfter: Math.ceil(rateLimit.resetIn / 1000)
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
                        'X-RateLimit-Remaining': '0',
                    }
                }
            );
        }

        // Ensure default admin exists on first login attempt
        await ensureAdminExists();

        // Validate request body with Zod
        const validation = await validateBody(request, loginSchema);
        if (!validation.success) {
            return validation.response;
        }
        const { username, password } = validation.data;

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const token = await createToken(user.id, user.role);
        await setAuthCookie(token);

        logger.debug('Auth', `User logged in: ${username}`);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                mustResetPassword: user.must_reset_password === 1,
            },
        });
    } catch (error) {
        logger.error('Auth', 'Login error', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

