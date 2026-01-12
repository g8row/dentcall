import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
        authenticated: true,
        user: {
            id: session.user.id,
            username: session.user.username,
            role: session.user.role,
            daily_target: session.user.daily_target,
        },
    });
}
