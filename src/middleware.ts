import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Get JWT secret - must be set in production
const jwtSecretValue = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !jwtSecretValue) {
    throw new Error('JWT_SECRET environment variable must be set in production');
}
const JWT_SECRET = new TextEncoder().encode(
    jwtSecretValue || 'dev-only-secret-not-for-production'
);

type Role = 'ADMIN' | 'CALLER';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
    '/api/auth/login',
    '/api/auth/session',
];

// Routes that require ADMIN role
const ADMIN_ROUTES = [
    '/api/admin',
    '/api/users',
    '/api/campaigns',
];

/**
 * Verify JWT token (Edge-compatible, no database access)
 */
async function verifyTokenEdge(token: string): Promise<{ userId: string; role: Role } | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return {
            userId: payload.userId as string,
            role: payload.role as Role,
        };
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Skip non-API routes (let Next.js handle them)
    if (!path.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Allow public routes
    if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
        return NextResponse.next();
    }

    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
        return NextResponse.json(
            { success: false, error: 'Authentication required' },
            { status: 401 }
        );
    }

    // Verify token
    const payload = await verifyTokenEdge(token);
    if (!payload) {
        return NextResponse.json(
            { success: false, error: 'Invalid or expired token' },
            { status: 401 }
        );
    }

    // Check admin-only routes
    const isAdminRoute = ADMIN_ROUTES.some(route => path.startsWith(route));
    if (isAdminRoute && payload.role !== 'ADMIN') {
        return NextResponse.json(
            { success: false, error: 'Admin access required' },
            { status: 403 }
        );
    }

    // Add user info to request headers for route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-role', payload.role);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: '/api/:path*',
};
