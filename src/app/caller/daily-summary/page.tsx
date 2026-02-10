'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useTranslation } from '@/lib/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
}

interface Call {
  id: string;
  dentist_id: string;
  outcome: string;
  notes: string | null;
  called_at: string;
  facility_name?: string;
}

interface DailySummary {
  id: string;
  caller_id: string;
  summary_date: string;
  summary_notes: string;
  call_count: number;
  call_ids: string | null;
  created_at: string;
}

type OutcomeKey = 'interested' | 'not_interested' | 'no_answer' | 'callback' | 'order_taken' | 'other';

const OUTCOME_LABELS: Record<string, OutcomeKey> = {
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  NO_ANSWER: 'no_answer',
  CALLBACK: 'callback',
  ORDER_TAKEN: 'order_taken',
};

export default function DailySummaryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summaryNotes, setSummaryNotes] = useState('');
  const [todayCalls, setTodayCalls] = useState<Call[]>([]);
  const [attachCalls, setAttachCalls] = useState(true);
  const [existingSummary, setExistingSummary] = useState<DailySummary | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadCallsForDate();
      loadExistingSummary();
    }
  }, [selectedDate, user]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setUser(data.user);
    } catch (error) {
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadCallsForDate = async () => {
    try {
      const res = await fetch(`/api/calls?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        // Filter out internal IMPLANT_STATUS outcome
        const calls = (data.calls || []).filter((call: Call) => call.outcome !== 'IMPLANT_STATUS');
        setTodayCalls(calls);
      }
    } catch (error) {
      console.error('Error loading calls:', error);
    }
  };

  const loadExistingSummary = async () => {
    try {
      const res = await fetch(`/api/daily-summaries?summary_date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        if (data.summaries && data.summaries.length > 0) {
          const summary = data.summaries[0];
          setExistingSummary(summary);
          setSummaryNotes(summary.summary_notes);
        } else {
          setExistingSummary(null);
          setSummaryNotes('');
        }
      }
    } catch (error) {
      console.error('Error loading existing summary:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!summaryNotes.trim()) {
      setMessage({ type: 'error', text: t('summary_error') });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const callIds = attachCalls ? todayCalls.map(call => call.id) : [];

      const res = await fetch('/api/daily-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary_date: selectedDate,
          summary_notes: summaryNotes,
          call_ids: callIds,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ 
          type: 'success', 
          text: existingSummary ? t('summary_updated') : t('summary_submitted') 
        });
        setExistingSummary(data.summary);
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || t('summary_error') });
      }
    } catch (error) {
      console.error('Error submitting summary:', error);
      setMessage({ type: 'error', text: t('summary_error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-xl">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push('/caller')}
                className="text-cyan-400 hover:text-cyan-300 mb-2"
              >
                ← {t('back')}
              </button>
              <h1 className="text-2xl font-bold text-cyan-400">
                {t('daily_summary_title')}
              </h1>
              {user && (
                <p className="text-sm text-slate-400 mt-1">
                  {user.display_name || user.username}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Date Selector */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t('summary_for')}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          {todayCalls.length > 0 && (
            <p className="text-sm text-slate-400 mt-2">
              {t('today_calls_count')}: <span className="text-cyan-400 font-semibold">{todayCalls.length}</span>
            </p>
          )}
        </div>

        {/* Summary Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">
            {t('my_daily_summary')}
          </h2>

          {existingSummary && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-400">
                {t('summary_already_exists')}
              </p>
            </div>
          )}

          {message && (
            <div
              className={`rounded-lg p-4 mb-4 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('summary_notes_label')} *
            </label>
            <textarea
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder={t('summary_notes_placeholder')}
              rows={10}
              required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-vertical"
            />
          </div>

          {todayCalls.length > 0 && (
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachCalls}
                  onChange={(e) => setAttachCalls(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">
                  {t('attach_calls')} ({todayCalls.length})
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !summaryNotes.trim()}
              className="flex-1 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
            >
              {submitting ? t('loading') : t('submit_daily_summary')}
            </button>
          </div>
        </form>

        {/* Call List (if any) */}
        {todayCalls.length > 0 && (
          <div className="mt-6 bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              {t('today_calls')} ({todayCalls.length})
            </h3>
            <div className="space-y-2">
              {todayCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      {call.facility_name || `Dentist ${call.dentist_id.slice(0, 8)}`}
                    </p>
                    {call.notes && (
                      <p className="text-xs text-slate-400 mt-1">{call.notes}</p>
                    )}
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                    {t(OUTCOME_LABELS[call.outcome] ?? 'other')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
