import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// Export data as Excel
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'dentists';

  try {
    let data: Record<string, unknown>[];
    let filename: string;

    if (type === 'dentists') {
      data = db.prepare(`
        SELECT 
          d.facility_name as "Facility Name",
          d.region as "Region",
          d.manager as "Manager",
          d.phones as "Phones",
          d.cities_served as "Cities",
          d.staff_count as "Staff Count",
          d.eik as "EIK",
          u.username as "Preferred Caller",
          (SELECT outcome FROM calls WHERE dentist_id = d.id ORDER BY called_at DESC LIMIT 1) as "Last Outcome",
          (SELECT called_at FROM calls WHERE dentist_id = d.id ORDER BY called_at DESC LIMIT 1) as "Last Called"
        FROM dentists d
        LEFT JOIN users u ON d.preferred_caller_id = u.id
        ORDER BY d.region, d.facility_name
      `).all() as Record<string, unknown>[];

      // Parse phones and cities JSON safely
      data = data.map(row => {
        let phones = '';
        let cities = '';

        try {
          phones = JSON.parse((row.Phones as string) || '[]').join(', ');
        } catch {
          phones = row.Phones as string || '';
        }

        try {
          // Cities might be JSON ["City"] or legacy "City;City" string
          const rawCities = row.Cities as string || '';
          if (rawCities.trim().startsWith('[')) {
            cities = JSON.parse(rawCities).join(', ');
          } else {
            cities = rawCities.split(';').map(c => c.trim()).filter(Boolean).join(', ');
          }
        } catch {
          cities = row.Cities as string || '';
        }

        return { ...row, Phones: phones, Cities: cities };
      });

      filename = 'dentists_export.xlsx';
    } else if (type === 'calls') {
      // Bulgarian translations for outcomes
      const outcomeTranslations: Record<string, string> = {
        'INTERESTED': 'Заинтересован',
        'NOT_INTERESTED': 'Не се интересува',
        'NO_ANSWER': 'Няма отговор',
        'CALLBACK': 'Обратна връзка',
        'ORDER_TAKEN': 'Взета заявка',
        'IMPLANT_STATUS': 'Промяна на статус импланти',
      };

      // Date filtering
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      let dateFilter = '';
      const dateParams: string[] = [];

      if (startDate && endDate) {
        dateFilter = `WHERE DATE(c.called_at) >= ? AND DATE(c.called_at) <= ?`;
        dateParams.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = `WHERE DATE(c.called_at) >= ?`;
        dateParams.push(startDate);
      } else if (endDate) {
        dateFilter = `WHERE DATE(c.called_at) <= ?`;
        dateParams.push(endDate);
      }

      const rawData = db.prepare(`
        SELECT 
          d.facility_name as "Facility",
          d.region as "Region",
          u.username as "Caller",
          c.outcome as "Outcome",
          c.notes as "Notes",
          c.called_at as "Called At"
        FROM calls c
        JOIN dentists d ON c.dentist_id = d.id
        JOIN users u ON c.caller_id = u.id
        ${dateFilter}
        ORDER BY c.called_at DESC
      `).all(...dateParams) as Record<string, unknown>[];

      // Translate outcomes to Bulgarian
      data = rawData.map(row => ({
        ...row,
        Outcome: outcomeTranslations[row.Outcome as string] || row.Outcome,
      }));

      filename = 'calls_export.xlsx';

    } else if (type === 'stats') {
      data = db.prepare(`
        SELECT 
          u.username as "Caller",
          COUNT(c.id) as "Total Calls",
          SUM(CASE WHEN c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as "Interested",
          SUM(CASE WHEN c.outcome = 'NOT_INTERESTED' THEN 1 ELSE 0 END) as "Not Interested",
          SUM(CASE WHEN c.outcome = 'NO_ANSWER' THEN 1 ELSE 0 END) as "No Answer",
          SUM(CASE WHEN c.outcome = 'CALLBACK' THEN 1 ELSE 0 END) as "Callback",
          SUM(CASE WHEN c.outcome = 'ORDER_TAKEN' THEN 1 ELSE 0 END) as "Order Taken"
        FROM users u
        LEFT JOIN calls c ON u.id = c.caller_id
        WHERE u.role = 'CALLER'
        GROUP BY u.id
        ORDER BY COUNT(c.id) DESC
      `).all() as Record<string, unknown>[];

      filename = 'caller_stats.xlsx';
    } else {
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 });
    }

    // Create workbook using array of arrays for more reliable encoding
    const wb = XLSX.utils.book_new();

    // Get headers
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]));

    // Create worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Auto-size columns
    const maxLengths = headers.map((h, i) => {
      const colValues = [h, ...rows.map(r => String(r[i] || ''))];
      return Math.min(50, Math.max(...colValues.map(v => v.length)));
    });
    ws['!cols'] = maxLengths.map(wch => ({ wch }));

    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Write to buffer with explicit options
    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed', details: String(error) }, { status: 500 });
  }
}
