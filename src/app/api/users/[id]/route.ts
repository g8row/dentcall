import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

// Update user
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const { username, password, role, daily_target, display_name } = await request.json();

        const updates: string[] = [];
        const values: (string | number)[] = [];

        if (username) {
            updates.push('username = ?');
            values.push(username);
        }
        if (display_name !== undefined) {
            updates.push('display_name = ?');
            values.push(display_name);
        }
        if (password) {
            updates.push('password = ?');
            values.push(await hashPassword(password));
        }
        if (role) {
            updates.push('role = ?');
            values.push(role);
        }
        if (daily_target !== undefined) {
            updates.push('daily_target = ?');
            values.push(daily_target);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        values.push(id);

        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Delete user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;

        // Don't allow deleting yourself
        if (id === session.user.id) {
            return NextResponse.json(
                { error: 'Cannot delete your own account' },
                { status: 400 }
            );
        }

        // Check if user exists
        const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as { id: string; username: string } | undefined;
        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Use a transaction to ensure all related data is cleaned up
        // Temporarily disable foreign keys to avoid constraint issues
        const deleteUser = db.transaction((userId: string) => {
            // Disable foreign key checks temporarily
            db.pragma('foreign_keys = OFF');

            try {
                // 1. Update campaigns that reference this caller in target_callers JSON
                const campaigns = db.prepare('SELECT id, target_callers FROM campaigns WHERE target_callers IS NOT NULL').all() as { id: string; target_callers: string }[];
                for (const campaign of campaigns) {
                    try {
                        const callers = JSON.parse(campaign.target_callers) as string[];
                        const filtered = callers.filter((cid: string) => cid !== userId);
                        if (filtered.length !== callers.length) {
                            db.prepare('UPDATE campaigns SET target_callers = ? WHERE id = ?').run(
                                filtered.length > 0 ? JSON.stringify(filtered) : null,
                                campaign.id
                            );
                        }
                    } catch {
                        // Skip if JSON parsing fails
                    }
                }

                // 2. Unassign from dentists (nullable foreign key)
                db.prepare('UPDATE dentists SET preferred_caller_id = NULL WHERE preferred_caller_id = ?').run(userId);

                // 3. Delete assignments (non-nullable foreign key)
                db.prepare('DELETE FROM assignments WHERE caller_id = ?').run(userId);

                // 4. Delete calls history (non-nullable foreign key)
                db.prepare('DELETE FROM calls WHERE caller_id = ?').run(userId);

                // 5. Finally delete the user
                db.prepare('DELETE FROM users WHERE id = ?').run(userId);
            } finally {
                // Re-enable foreign key checks
                db.pragma('foreign_keys = ON');
            }
        });

        deleteUser(id);

        return NextResponse.json({ success: true, message: `User ${user.username} deleted successfully` });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json(
            { error: 'Failed to delete user. Please try again or contact support.' },
            { status: 500 }
        );
    }
}
