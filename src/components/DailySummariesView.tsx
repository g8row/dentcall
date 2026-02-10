'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from '@/lib/translations';

interface DailySummary {
  id: string;
  caller_id: string;
  summary_date: string;
  summary_notes: string;
  call_count: number;
  call_ids: string | null;
  created_at: string;
  caller_name?: string;
  username?: string;
}

export default function DailySummariesView() {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaller, setSelectedCaller] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [callers, setCallers] = useState<{ id: string; name: string }[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCallers();
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [selectedCaller, startDate, endDate]);

  const loadCallers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const callerList = data.users
          .filter((u: any) => u.role === 'CALLER')
          .map((u: any) =>({ 
            id: u.id,
            name: u.display_name || u.username
          }));
        setCallers(callerList);
      }
    } catch (error) {
      console.error('Error loading callers:', error);
    }
  };

  const loadSummaries = async () => {
    setLoading(true);
    try {
      let url = '/api/daily-summaries?';
      if (selectedCaller) url += `caller_id=${selectedCaller}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummaries(data.summaries || []);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportSummaries = () => {
    const csv = [
      ['Date', 'Caller', 'Call Count', 'Summary', 'Submitted At'].join(','),
      ...summaries.map(s => [
        s.summary_date,
        `"${s.caller_name || s.username}"`,
        s.call_count,
        `"${s.summary_notes.replace(/"/g, '""')}"`,
        format(new Date(s.created_at), 'yyyy-MM-dd HH:mm')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-summaries-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const sendDailyEmail = async () => {
    setSendingEmail(true);
    setEmailMessage(null);

    try {
      const emailDate = endDate; // Use the selected end date as the email date
      const res = await fetch(`/api/daily-email?date=${emailDate}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setEmailMessage({ 
          type: 'success', 
          text: `Daily email sent successfully for ${format(new Date(emailDate), 'MMM d, yyyy')}` 
        });
      } else {
        setEmailMessage({ 
          type: 'error', 
          text: data.error || 'Failed to send email' 
        });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailMessage({ 
        type: 'error', 
        text: 'Error sending email. Check console for details.' 
      });
    } finally {
      setSendingEmail(false);
      // Clear message after 5 seconds
      setTimeout(() => setEmailMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">{t('all_summaries')}</h2>
        <div className="flex gap-2">
          <button
            onClick={sendDailyEmail}
            disabled={sendingEmail}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {sendingEmail ? 'Sending...' : 'Send Daily Email'}
          </button>
          {summaries.length > 0 && (
            <button
              onClick={exportSummaries}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Email Message */}
      {emailMessage && (
        <div
          className={`rounded-lg p-4 ${
            emailMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {emailMessage.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('caller')}
            </label>
            <select
              value={selectedCaller}
              onChange={(e) => setSelectedCaller(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="" className="bg-slate-800">All Callers</option>
              {callers.map(caller => (
                <option key={caller.id} value={caller.id} className="bg-slate-800">{caller.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('start_date')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Summaries List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500 mx-auto mb-2"></div>
          <p className="text-slate-400">{t('loading')}</p>
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">{t('no_summaries')}</h3>
          <p className="text-slate-400">Callers haven't submitted any daily summaries yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <div
              key={summary.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-6 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    {summary.caller_name || summary.username}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                    <span>📅 {format(new Date(summary.summary_date), 'MMMM d, yyyy')}</span>
                    <span>📞 {summary.call_count} {t('calls')}</span>
                    <span className="text-slate-500">
                      {t('submitted_at')}: {format(new Date(summary.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-300 whitespace-pre-wrap">{summary.summary_notes}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {summaries.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-1">Total Summaries</p>
              <p className="text-2xl font-bold text-emerald-400">{summaries.length}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-1">Total Calls Reported</p>
              <p className="text-2xl font-bold text-cyan-400">
                {summaries.reduce((acc, s) => acc + s.call_count, 0)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-1">Active Reporters</p>
              <p className="text-2xl font-bold text-purple-400">
                {new Set(summaries.map(s => s.caller_id)).size}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
