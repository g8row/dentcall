import { format } from 'date-fns';

export interface EmailConfig {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using a configured email service
 * This is a placeholder implementation that logs to console.
 * 
 * To use a real email service, you need to:
 * 1. Install nodemailer: npm install nodemailer
 * 2. Configure SMTP settings in environment variables:
 *    - EMAIL_HOST (e.g., smtp.gmail.com)
 *    - EMAIL_PORT (e.g., 587)
 *    - EMAIL_USER (your email address)
 *    - EMAIL_PASSWORD (app password or regular password)
 *    - EMAIL_FROM (sender email address)
 *    - EMAIL_TO (comma-separated list of recipient emails)
 * 
 * Example implementation with nodemailer:
 * ```
 * import nodemailer from 'nodemailer';
 * 
 * const transporter = nodemailer.createTransport({
 *   host: process.env.EMAIL_HOST,
 *   port: parseInt(process.env.EMAIL_PORT || '587'),
 *   secure: false,
 *   auth: {
 *     user: process.env.EMAIL_USER,
 *     pass: process.env.EMAIL_PASSWORD,
 *   },
 * });
 * 
 * await transporter.sendMail(config);
 * ```
 */
export async function sendEmail(config: EmailConfig): Promise<void> {
  // Check if email is configured
  const isConfigured = process.env.EMAIL_HOST && process.env.EMAIL_USER;

  if (!isConfigured) {
    console.log('📧 Email not configured. Email would be sent:');
    console.log(`   From: ${config.from}`);
    console.log(`   To: ${config.to.join(', ')}`);
    console.log(`   Subject: ${config.subject}`);
    console.log(`   HTML Length: ${config.html.length} chars`);
    console.log(`   Preview: ${config.text?.substring(0, 200) || 'No text preview'}...`);
    return;
  }

  // TODO: Implement actual email sending with nodemailer
  // For now, just log that we would send an email
  console.log('📧 Email would be sent (nodemailer not installed):');
  console.log(`   From: ${config.from}`);
  console.log(`   To: ${config.to.join(', ')}`);
  console.log(`   Subject: ${config.subject}`);

  // Uncomment when nodemailer is installed:
  /*
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail(config);
  console.log('✅ Email sent successfully');
  */
}

/**
 * Generate HTML for daily summary email
 */
export function generateDailySummaryEmail(data: {
  date: string;
  summaries: Array<{
    caller_name: string;
    call_count: number;
    summary_notes: string;
  }>;
  stats: {
    total_calls: number;
    total_dentists: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    order_taken: number;
  };
  logs?: string[];
}): { html: string; text: string } {
  const totalCalls = data.stats.total_calls;
  const interestedRate = totalCalls > 0 ? ((data.stats.interested / totalCalls) * 100).toFixed(1) : '0';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 28px; font-weight: bold; color: #059669; }
          .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 5px; }
          .summary-card { background: #ffffff; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .caller-name { font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 10px; }
          .call-count { display: inline-block; background: #06b6d4; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-bottom: 10px; }
          .notes { color: #475569; white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 6px; }
          .logs { background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 11px; max-height: 300px; overflow-y: auto; }
          .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
          h2 { color: #0f172a; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">📊 Daily Summary Report</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${format(new Date(data.date), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        <h2>📈 Statistics</h2>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${totalCalls}</div>
            <div class="stat-label">Total Calls</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.interested}</div>
            <div class="stat-label">Interested</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${interestedRate}%</div>
            <div class="stat-label">Success Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.callback}</div>
            <div class="stat-label">Callbacks</div>
          </div>
        </div>

        <h2>📝 Caller Summaries</h2>
        ${data.summaries.length > 0 ? data.summaries.map(summary => `
          <div class="summary-card">
            <div class="caller-name">${summary.caller_name}</div>
            <span class="call-count">${summary.call_count} calls</span>
            <div class="notes">${summary.summary_notes}</div>
          </div>
        `).join('') : '<p style="color: #94a3b8;">No summaries submitted for this day.</p>'}

        ${data.logs && data.logs.length > 0 ? `
          <h2>🔍 System Logs</h2>
          <div class="logs">
            ${data.logs.join('\n')}
          </div>
        ` : ''}

        <div class="footer">
          <p>This is an automated daily summary from DentCall Cold Caller System</p>
          <p>Generated at ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
        </div>
      </body>
    </html>
  `;

  const text = `
DAILY SUMMARY REPORT - ${format(new Date(data.date), 'EEEE, MMMM d, yyyy')}

STATISTICS:
- Total Calls: ${totalCalls}
- Interested: ${data.stats.interested}
- Not Interested: ${data.stats.not_interested}
- No Answer: ${data.stats.no_answer}
- Callbacks: ${data.stats.callback}
- Orders Taken: ${data.stats.order_taken}
- Success Rate: ${interestedRate}%

CALLER SUMMARIES:
${data.summaries.length > 0 ? data.summaries.map(summary => `
${summary.caller_name} (${summary.call_count} calls):
${summary.summary_notes}
---
`).join('\n') : 'No summaries submitted for this day.'}

${data.logs && data.logs.length > 0 ? `
SYSTEM LOGS:
${data.logs.join('\n')}
` : ''}

---
This is an automated daily summary from DentCall Cold Caller System
Generated at ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
  `.trim();

  return { html, text };
}
