import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail, generateDailySummaryEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

// GET /api/daily-email - Send daily summary email
// Can be called manually by admin or triggered by a cron job
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  // Allow unauthenticated access if proper API key is provided (for cron jobs)
  const apiKey = request.nextUrl.searchParams.get('api_key');
  const configuredApiKey = process.env.DAILY_EMAIL_API_KEY;
  
  const isAuthorized = 
    (session && session.role === 'ADMIN') || 
    (apiKey && configuredApiKey && apiKey === configuredApiKey);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get date parameter (default to yesterday)
    const dateParam = request.nextUrl.searchParams.get('date');
    const targetDate = dateParam || format(subDays(new Date(), 1), 'yyyy-MM-dd');

    logger.info('EMAIL', `Generating daily summary email for date: ${targetDate}`);

    // Get daily summaries from callers
    const summaries = db
      .prepare(`
        SELECT 
          ds.*,
          COALESCE(u.display_name, u.username) AS caller_name
        FROM daily_summaries ds
        JOIN users u ON ds.caller_id = u.id
        WHERE ds.summary_date = ?
        ORDER BY ds.created_at DESC
      `)
      .all(targetDate) as Array<{
        id: string;
        caller_id: string;
        summary_date: string;
        summary_notes: string;
        call_count: number;
        caller_name: string;
      }>;

    // Get call statistics for the day
    const stats = db
      .prepare(`
        SELECT 
          COUNT(*) as total_calls,
          COUNT(DISTINCT dentist_id) as total_dentists,
          SUM(CASE WHEN outcome = 'INTERESTED' THEN 1 ELSE 0 END) as interested,
          SUM(CASE WHEN outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as not_interested,
          SUM(CASE WHEN outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
          SUM(CASE WHEN outcome = 'CALLBACK' THEN 1 ELSE 0 END) as callback,
          SUM(CASE WHEN outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as order_taken
        FROM calls
        WHERE DATE(called_at) = ?
      `)
      .get(targetDate) as {
        total_calls: number;
        total_dentists: number;
        interested: number;
        not_interested: number;
        no_answer: number;
        callback: number;
        order_taken: number;
      };

    // Get additional logs (optional - recent errors, warnings, etc.)
    const logs: string[] = [];

    // You can add system logs here if needed
    // For example, checking for failed calls, system errors, etc.
    const pendingCallbacks = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM calls c
        WHERE c.outcome = 'CALLBACK'
          AND c.dentist_id NOT IN (
            SELECT DISTINCT dentist_id 
            FROM calls 
            WHERE DATE(called_at) = ? AND outcome != 'CALLBACK'
          )
      `)
      .get(targetDate) as { count: number };

    if (pendingCallbacks.count > 0) {
      logs.push(`⚠️ ${pendingCallbacks.count} callbacks still pending`);
    }

    // Prepare email config
    const emailTo = process.env.EMAIL_TO?.split(',').map(e => e.trim()) || [];
    const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@dentcall.app';

    // Check if email is configured
    if (emailTo.length === 0) {
      logger.warn('EMAIL', 'No email recipients configured (EMAIL_TO environment variable)');
    }

    // Generate email content
    const emailContent = generateDailySummaryEmail({
      date: targetDate,
      summaries: summaries.map(s => ({
        caller_name: s.caller_name,
        call_count: s.call_count,
        summary_notes: s.summary_notes,
      })),
      stats,
      logs: logs.length > 0 ? logs : undefined,
    });

    if (emailTo.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No email recipients configured',
        preview: {
          subject: `Daily Summary - ${format(new Date(targetDate), 'MMM d, yyyy')}`,
          stats,
          summaries_count: summaries.length,
          html_length: emailContent.html.length,
        },
      });
    }

    // Send email
    await sendEmail({
      from: emailFrom,
      to: emailTo,
      subject: `Daily Summary - ${format(new Date(targetDate), 'MMM d, yyyy')}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    logger.info('EMAIL', `Daily summary email sent successfully for ${targetDate}`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      recipients: emailTo.length,
      stats,
      summaries_count: summaries.length,
    });
  } catch (error: any) {
    logger.error('EMAIL', 'Error sending daily summary email', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send daily summary email' },
      { status: 500 }
    );
  }
}

// POST /api/daily-email - Same as GET but via POST
export async function POST(request: NextRequest) {
  return GET(request);
}
