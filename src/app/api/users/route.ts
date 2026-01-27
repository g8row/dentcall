import { NextRequest, NextResponse } from 'next/server';
import db, { User } from '@/lib/db';
import { getSession, hashPassword, generateId } from '@/lib/auth';

// Get all users (admin only)
export async function GET() {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = db.prepare(`
    SELECT id, username, display_name, role, daily_target, created_at 
    FROM users 
    ORDER BY created_at DESC
  `).all() as Omit<User, 'password'>[];

    return NextResponse.json({ users });
}

// Create new user (admin only)
export async function POST(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { username, password, role, daily_target, display_name } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Check if username exists
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return NextResponse.json(
                { error: 'Username already exists' },
                { status: 400 }
            );
        }

        const hashedPassword = await hashPassword(password);
        const id = generateId();
        // Use display_name if provided, otherwise fall back to username
        const finalDisplayName = display_name || username;

        db.prepare(`
      INSERT INTO users (id, username, display_name, password, role, daily_target)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, finalDisplayName, hashedPassword, role || 'CALLER', daily_target || 50);

        return NextResponse.json({
            success: true,
            user: { id, username, display_name: finalDisplayName, role: role || 'CALLER', daily_target: daily_target || 50 },
        });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
