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
  callers: Array<{
    caller_name: string;
    total_calls: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callback: number;
    order_taken: number;
    summary_notes: string | null;
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
          .header-title { color: #f8fafc; font-size: 24px; font-weight: 700; margin: 0; }
          .header-title span { color: #06b6d4; }
          .header-date { color: #94a3b8; margin: 8px 0 0 0; font-size: 15px; }

          h2 { color: #f8fafc; font-size: 20px; font-weight: 600; margin: 35px 0 15px 0; border-bottom: 1px solid #334155; padding-bottom: 10px; }
          h2 span { color: #06b6d4; }

          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin: 20px 0; }
          .stat-card { background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 10px; text-align: center; }
          .stat-value { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 6px; }
          .stat-value.primary { color: #06b6d4; }
          .stat-value.success { color: #10b981; }
          .stat-value.warning { color: #f59e0b; }
          .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }

          .caller-card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
          .caller-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #1e293b; border-bottom: 1px solid #334155; }
          .caller-name { font-size: 16px; font-weight: 600; color: #f8fafc; }
          .caller-name::before { content: "👤 "; }
          .caller-mini-stats { display: flex; gap: 12px; padding: 14px 20px; flex-wrap: wrap; border-bottom: 1px solid #1e293b; }
          .mini-stat { text-align: center; min-width: 60px; }
          .mini-stat-value { font-size: 18px; font-weight: 700; }
          .mini-stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
          .mini-stat-value.s-total { color: #06b6d4; }
          .mini-stat-value.s-int { color: #10b981; }
          .mini-stat-value.s-cb { color: #f59e0b; }
          .mini-stat-value.s-ord { color: #a78bfa; }
          .mini-stat-value.s-na { color: #94a3b8; }
          .mini-stat-value.s-ni { color: #f87171; }
          .caller-notes { padding: 16px 20px; }
          .notes-text { color: #cbd5e1; white-space: pre-wrap; background: #1e293b; padding: 14px; border-radius: 8px; font-size: 14px; border: 1px solid #334155; }
          .no-notes { color: #475569; font-style: italic; font-size: 13px; padding: 10px 0 4px 0; }

          .logs { background: #1e293b; color: #cbd5e1; padding: 16px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; border: 1px solid #334155; border-left: 3px solid #f59e0b; }
          .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 40px; padding-top: 25px; border-top: 1px solid #1e293b; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="header-title"><span>DentCall</span> — Дневен Отчет</h1>
          <p class="header-date">${format(new Date(data.date), 'EEEE, d MMMM yyyy г.')}</p>
        </div>

        <h2><span>📈</span> Обща Статистика</h2>
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

        <h2><span>👥</span> Оператори (${data.callers.length})</h2>
        ${data.callers.length > 0 ? data.callers.map(caller => `
          <div class="caller-card">
            <div class="caller-header">
              <div class="caller-name">${caller.caller_name}</div>
            </div>
            <div class="caller-mini-stats">
              <div class="mini-stat"><div class="mini-stat-value s-total">${caller.total_calls}</div><div class="mini-stat-label">Общо</div></div>
              <div class="mini-stat"><div class="mini-stat-value s-int">${caller.interested}</div><div class="mini-stat-label">Интерес</div></div>
              <div class="mini-stat"><div class="mini-stat-value s-ord">${caller.order_taken}</div><div class="mini-stat-label">Поръчки</div></div>
              <div class="mini-stat"><div class="mini-stat-value s-cb">${caller.callback}</div><div class="mini-stat-label">Преобажд.</div></div>
              <div class="mini-stat"><div class="mini-stat-value s-na">${caller.no_answer}</div><div class="mini-stat-label">Няма отг.</div></div>
              <div class="mini-stat"><div class="mini-stat-value s-ni">${caller.not_interested}</div><div class="mini-stat-label">Незаинт.</div></div>
            </div>
            <div class="caller-notes">
              ${caller.summary_notes
      ? `<div class="notes-text">${caller.summary_notes}</div>`
      : `<div class="no-notes">Не е подал дневно обобщение.</div>`
    }
            </div>
          </div>
        `).join('') : '<p style="color: #64748b; font-style: italic; background: #0f172a; padding: 20px; border-radius: 8px; border: 1px dashed #334155; text-align: center;">Няма активност за този ден.</p>'}

        ${data.logs && data.logs.length > 0 ? `
          <h2><span>🔍</span> Системни Известия</h2>
          <div class="logs">${data.logs.join('<br>')}</div>
        ` : ''}

        <div class="footer">
          <p>Автоматичен ежедневен отчет от DentCall Cold Caller System</p>
          <p>Генериран на ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
        </div>
      </body>
    </html>
  `;

  const text = `
ДНЕВЕН ОТЧЕТ — ${format(new Date(data.date), 'EEEE, d MMMM yyyy г.')}

ОБЩА СТАТИСТИКА:
- Общо обаждания: ${totalCalls}
- Заинтересовани: ${data.stats.interested}
- Незаинтересовани: ${data.stats.not_interested}
- Няма отговор: ${data.stats.no_answer}
- За преобаждане: ${data.stats.callback}
- Направени поръчки: ${data.stats.order_taken}
- Успеваемост: ${interestedRate}%

ОПЕРАТОРИ:
${data.callers.length > 0 ? data.callers.map(caller => `
👤 ${caller.caller_name}
   Общо: ${caller.total_calls} | Интерес: ${caller.interested} | Поръчки: ${caller.order_taken} | Преобажд.: ${caller.callback} | Нняма отг.: ${caller.no_answer} | Незаинт.: ${caller.not_interested}
${caller.summary_notes
      ? `   Обобщение:\n   ${caller.summary_notes.replace(/\n/g, '\n   ')}`
      : '   Не е подал дневно обобщение.'
    }
-------------------------------------------
`).join('\n') : 'Няма активност за този ден.'}

${data.logs && data.logs.length > 0 ? `СИСТЕМНИ ИЗВЕСТИЯ:\n${data.logs.join('\n')}\n` : ''}

---
Автоматичен ежедневен отчет от DentCall Cold Caller System
Генериран на ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
  `.trim();

  return { html, text };
}

