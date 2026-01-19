import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface CampaignRow {
    id: string;
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    target_regions: string | null;
    target_cities: string | null;
    target_callers: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
    cancelled_at: string | null;
}

// Get all campaigns from the persistent campaigns table
export async function GET(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status: ACTIVE, COMPLETED, CANCELLED

    try {
        // Query campaigns from table
        let campaignsQuery = `SELECT * FROM campaigns`;
        const params: string[] = [];

        if (status) {
            campaignsQuery += ` WHERE status = ?`;
            params.push(status);
        }

        campaignsQuery += ` ORDER BY created_at DESC`;

        const campaigns = db.prepare(campaignsQuery).all(...params) as CampaignRow[];

        // Enrich each campaign with stats
        const enrichedCampaigns = campaigns.map(campaign => {
            // Get assignment stats - count only assignments linked to this campaign
            const assignmentStats = db.prepare(`
                SELECT 
                    COUNT(*) as total_assignments,
                    SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_assignments
                FROM assignments 
                WHERE campaign_id = ?
            `).get(campaign.id) as { total_assignments: number; completed_assignments: number } || { total_assignments: 0, completed_assignments: 0 };

            // Get outcome stats - only count calls for dentists in this campaign's assignments
            const outcomes = db.prepare(`
                SELECT 
                    c.outcome,
                    COUNT(*) as count
                FROM calls c
                WHERE c.dentist_id IN (
                    SELECT DISTINCT dentist_id FROM assignments WHERE campaign_id = ?
                )
                AND DATE(c.called_at) >= ? AND DATE(c.called_at) <= ?
                GROUP BY c.outcome
            `).all(campaign.id, campaign.start_date, campaign.end_date) as { outcome: string; count: number }[];

            const outcomeStats: Record<string, number> = {};
            outcomes.forEach(o => { outcomeStats[o.outcome] = o.count; });

            // Get caller info
            const callerIds = campaign.target_callers ? JSON.parse(campaign.target_callers) : [];
            let callerNames: string[] = [];
            if (callerIds.length > 0) {
                const callers = db.prepare(`
                    SELECT username FROM users WHERE id IN (${callerIds.map(() => '?').join(',')})
                `).all(...callerIds) as { username: string }[];
                callerNames = callers.map(c => c.username);
            }

            return {
                id: campaign.id,
                name: campaign.name,
                description: campaign.description,
                start_date: campaign.start_date,
                end_date: campaign.end_date,
                regions: campaign.target_regions ? JSON.parse(campaign.target_regions).join(', ') : 'All Regions',
                cities: campaign.target_cities ? JSON.parse(campaign.target_cities).join(', ') : null,
                callers: callerNames.length > 0 ? callerNames.join(', ') : 'All Callers',
                status: campaign.status,
                total_assignments: assignmentStats.total_assignments,
                completed_assignments: assignmentStats.completed_assignments,
                outcomes: outcomeStats,
                created_at: campaign.created_at,
                completed_at: campaign.completed_at,
                cancelled_at: campaign.cancelled_at,
            };
        });

        return NextResponse.json({ campaigns: enrichedCampaigns });
    } catch (error) {
        console.error('Get campaigns error:', error);
        return NextResponse.json({ error: 'Failed to load campaigns' }, { status: 500 });
    }
}

// Update campaign (mark complete, update name, etc.)
export async function PATCH(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, name, status } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Campaign id is required' }, { status: 400 });
        }

        // Check campaign exists
        const existing = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as CampaignRow | undefined;
        if (!existing) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Build update query
        const updates: string[] = [];
        const params: (string | null)[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }

        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);

            if (status === 'COMPLETED') {
                updates.push('completed_at = datetime("now")');
            } else if (status === 'CANCELLED') {
                updates.push('cancelled_at = datetime("now")');
            }
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        params.push(id);
        db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        return NextResponse.json({ success: true, message: 'Campaign updated' });
    } catch (error) {
        console.error('Update campaign error:', error);
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
}

// Cancel/delete a campaign (soft delete by default, hard delete with force=true)
export async function DELETE(request: NextRequest) {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('id');
    const force = searchParams.get('force') === 'true';

    if (!campaignId) {
        return NextResponse.json({ error: 'Campaign id is required' }, { status: 400 });
    }

    try {
        // Check campaign exists
        const existing = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(campaignId) as CampaignRow | undefined;
        if (!existing) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        if (force) {
            // Hard delete: remove assignments and campaign
            const deletedAssignments = db.prepare(`DELETE FROM assignments WHERE campaign_id = ?`).run(campaignId);
            db.prepare(`DELETE FROM campaigns WHERE id = ?`).run(campaignId);

            return NextResponse.json({
                success: true,
                message: `Campaign permanently deleted`,
                deleted_assignments: deletedAssignments.changes,
            });
        } else {
            // Soft delete: just mark as cancelled
            db.prepare(`
                UPDATE campaigns 
                SET status = 'CANCELLED', cancelled_at = datetime('now')
                WHERE id = ?
            `).run(campaignId);

            return NextResponse.json({
                success: true,
                message: `Campaign cancelled (assignments preserved)`,
            });
        }
    } catch (error) {
        console.error('Delete campaign error:', error);
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
}
