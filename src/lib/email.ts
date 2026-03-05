import { format } from 'date-fns';
import nodemailer from 'nodemailer';

export interface EmailConfig {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using nodemailer with SMTP configuration.
 * Falls back to console logging if SMTP is not configured.
 * 
 * Required environment variables:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD
 *   EMAIL_FROM, EMAIL_TO (comma-separated)
 */
export async function sendEmail(config: EmailConfig): Promise<void> {
  const isConfigured = process.env.EMAIL_HOST && process.env.EMAIL_USER;

  if (!isConfigured) {
    console.log('📧 Email not configured (set EMAIL_HOST + EMAIL_USER). Preview:');
    console.log(`   From: ${config.from}`);
    console.log(`   To: ${config.to.join(', ')}`);
    console.log(`   Subject: ${config.subject}`);
    console.log(`   HTML Length: ${config.html.length} chars`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: config.to.join(', '),
    subject: config.subject,
    html: config.html,
    text: config.text,
  });

  console.log('✅ Email sent successfully to:', config.to.join(', '));
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
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.6; color: #f1f5f9; background-color: #020617; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid #334155; padding: 25px 30px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #06b6d4; }
          .header-title { color: #f8fafc; font-size: 24px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 10px; }
          .header-title span { color: #06b6d4; }
          .header-date { color: #94a3b8; margin: 8px 0 0 0; font-size: 15px; }
          
          h2 { color: #f8fafc; font-size: 20px; font-weight: 600; margin: 35px 0 15px 0; border-bottom: 1px solid #334155; padding-bottom: 10px; display: flex; align-items: center; gap: 8px; }
          h2 span { color: #06b6d4; }
          
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin: 20px 0; }
          .stat-card { background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 10px; text-align: center; }
          .stat-value { font-size: 28px; font-weight: 700; color: #f8fafc; line-height: 1; margin-bottom: 6px; }
          .stat-value.primary { color: #06b6d4; }
          .stat-value.success { color: #10b981; }
          .stat-value.warning { color: #f59e0b; }
          .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
          
          .summary-card { background: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 16px; }
          .summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #1e293b; padding-bottom: 15px; }
          .caller-name { font-size: 16px; font-weight: 600; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
          .caller-name::before { content: "👤"; font-size: 14px; }
          .call-count { background: #06b6d4; color: #ffffff; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .notes { color: #cbd5e1; white-space: pre-wrap; background: #1e293b; padding: 16px; border-radius: 8px; font-size: 14px; border: 1px solid #334155; }
          
          .logs { background: #1e293b; color: #cbd5e1; padding: 16px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; max-height: 300px; overflow-y: auto; border: 1px solid #334155; border-left: 3px solid #f59e0b; }
          
          .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 40px; padding-top: 25px; border-top: 1px solid #1e293b; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="header-title"><span>DentCall</span> Дневен Отчет</h1>
          <p class="header-date">${format(new Date(data.date), 'EEEE, d MMMM yyyy г.')}</p>
        </div>

        <h2><span>📈</span> Статистика за деня</h2>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value primary">${totalCalls}</div>
            <div class="stat-label">Общо Обаждания</div>
          </div>
          <div class="stat-card">
            <div class="stat-value success">${data.stats.interested}</div>
            <div class="stat-label">Заинтересовани</div>
          </div>
          <div class="stat-card">
            <div class="stat-value success">${interestedRate}%</div>
            <div class="stat-label">Успеваемост</div>
          </div>
          <div class="stat-card">
            <div class="stat-value warning">${data.stats.callback}</div>
            <div class="stat-label">За Преобаждане</div>
          </div>
        </div>

        <h2><span>📝</span> Обобщения от Операторите</h2>
        ${data.summaries.length > 0 ? data.summaries.map(summary => `
          <div class="summary-card">
            <div class="summary-header">
              <div class="caller-name">${summary.caller_name}</div>
              <span class="call-count">${summary.call_count} обаждания</span>
            </div>
            <div class="notes">${summary.summary_notes}</div>
          </div>
        `).join('') : '<p style="color: #64748b; font-style: italic; background: #0f172a; padding: 20px; border-radius: 8px; border: 1px dashed #334155; text-align: center;">Няма подадени обобщения за този ден.</p>'}

        ${data.logs && data.logs.length > 0 ? `
          <h2><span>🔍</span> Системни Известия</h2>
          <div class="logs">
            ${data.logs.join('<br>')}
          </div>
        ` : ''}

        <div class="footer">
          <p>Автоматичен ежедневен отчет от DentCall Cold Caller System</p>
          <p>Генериран на ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
        </div>
      </body>
    </html>
  `;

  const text = `
ДНЕВЕН ОТЧЕТ - ${format(new Date(data.date), 'EEEE, d MMMM yyyy г.')}

СТАТИСТИКА:
- Общо обаждания: ${totalCalls}
- Заинтересовани: ${data.stats.interested}
- Незаинтересовани: ${data.stats.not_interested}
- Няма отговор: ${data.stats.no_answer}
- За преобаждане: ${data.stats.callback}
- Направени поръчки: ${data.stats.order_taken}
- Успеваемост: ${interestedRate}%

ОБОБЩЕНИЯ ОТ ОПЕРАТОРИТЕ:
${data.summaries.length > 0 ? data.summaries.map(summary => `
👤 ${summary.caller_name} (${summary.call_count} обаждания):
${summary.summary_notes}
-------------------------------------------
`).join('\n') : 'Няма подадени обобщения за този ден.'}

${data.logs && data.logs.length > 0 ? `
СИСТЕМНИ ИЗВЕСТИЯ:
${data.logs.join('\n')}
` : ''}

---
Автоматичен ежедневен отчет от DentCall Cold Caller System
Генериран на ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
  `.trim();

  return { html, text };
}
