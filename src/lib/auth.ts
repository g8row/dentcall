import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import db, { User, Role } from './db';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const COOKIE_NAME = 'auth-token';

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function createToken(userId: string, role: Role): Promise<string> {
    return new SignJWT({ userId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: string; role: Role } | null> {
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

export async function getSession(): Promise<{ user: User; role: Role } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as User | undefined;

    if (!user) return null;

    return { user, role: user.role };
}

export async function setAuthCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}

export async function clearAuthCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

export function generateId(): string {
    return crypto.randomUUID();
}

// Create initial admin user if none exists
export async function ensureAdminExists(): Promise<void> {
    try {
        const adminExists = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();

        if (!adminExists) {
            const hashedPassword = await hashPassword('admin123');
            const id = generateId();

            db.prepare(`
          INSERT INTO users (id, username, password, role, daily_target, must_reset_password)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, 'admin', hashedPassword, 'ADMIN', 0, 1);

            console.log('Created default admin user');
        }
    } catch (error) {
        console.error('Failed to ensure admin exists:', error);
    }
}
