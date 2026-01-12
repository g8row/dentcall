'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useTranslation } from '@/lib/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface User {
    id: string;
    username: string;
    role: string;
    daily_target: number;
}

interface Assignment {
    id: string;
    date: string;
    dentist_id: string;
    facility_name: string;
    region: string;
    manager: string;
    phones: string[];
    cities_served: string;
    completed: number;
}

interface CallLog {
    id?: string;
    dentist_id: string;
    outcome: string;
    notes: string;
    called_at: string;
}

const OUTCOMES = [
    { value: 'INTERESTED', key: 'interested', emoji: '✅', color: 'emerald', bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
    { value: 'NOT_INTERESTED', key: 'not_interested', emoji: '❌', color: 'red', bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
    { value: 'NO_ANSWER', key: 'no_answer', emoji: '📵', color: 'slate', bg: 'bg-slate-600/30', border: 'border-slate-500', text: 'text-slate-400' },
    { value: 'CALLBACK', key: 'callback', emoji: '📞', color: 'amber', bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
    { value: 'FOLLOW_UP', key: 'follow_up', emoji: '⏳', color: 'cyan', bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400' },
];

function getOutcomeStyle(outcome: string) {
    return OUTCOMES.find(o => o.value === outcome) || OUTCOMES[2];
}

export default function CallerDashboard() {
    const router = useRouter();
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [todayCalls, setTodayCalls] = useState<CallLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCard, setActiveCard] = useState<string | null>(null);
    const [editingCall, setEditingCall] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState<string | null>(null);

    const today = format(new Date(), 'yyyy-MM-dd');

    const loadData = useCallback(async () => {
        const [assignmentsRes, callsRes] = await Promise.all([
            fetch(`/api/assignments?date=${today}`),
            fetch(`/api/calls?date=${today}`),
        ]);

        const assignmentsData = await assignmentsRes.json();
        const callsData = await callsRes.json();

        setAssignments(assignmentsData.assignments || []);
        setTodayCalls(callsData.calls || []);
    }, [today]);

    useEffect(() => {
        const checkAuth = async () => {
            const res = await fetch('/api/auth/session');
            const data = await res.json();

            if (!data.authenticated) {
                router.push('/');
                return;
            }

            setUser(data.user);
            setLoading(false);
        };

        checkAuth();
    }, [router]);

    useEffect(() => {
        if (!user) return;
        loadData();
    }, [user, loadData]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const handleLogCall = async (dentistId: string, outcome: string) => {
        setSubmitting(dentistId);

        try {
            const res = await fetch('/api/calls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dentist_id: dentistId,
                    outcome,
                    notes: notes[dentistId] || null,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                // Update local state
                setAssignments(assignments.map(a =>
                    a.dentist_id === dentistId ? { ...a, completed: 1 } : a
                ));
                setTodayCalls([...todayCalls, {
                    id: data.id,
                    dentist_id: dentistId,
                    outcome,
                    notes: notes[dentistId] || '',
                    called_at: new Date().toISOString(),
                }]);
                setActiveCard(null);
                setNotes({ ...notes, [dentistId]: '' });
            }
        } finally {
            setSubmitting(null);
        }
    };

    const handleEditCall = async (callId: string, dentistId: string, outcome: string) => {
        setSubmitting(dentistId);

        try {
            const res = await fetch(`/api/calls/${callId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    outcome,
                    notes: notes[dentistId] || undefined,
                }),
            });

            if (res.ok) {
                setTodayCalls(todayCalls.map(c =>
                    c.id === callId ? { ...c, outcome, notes: notes[dentistId] || c.notes } : c
                ));
                setEditingCall(null);
                setActiveCard(null);
            }
        } finally {
            setSubmitting(null);
        }
    };

    const completedCount = assignments.filter(a => a.completed).length;
    const progress = assignments.length > 0 ? (completedCount / assignments.length) * 100 : 0;

    // Outcome stats
    const outcomeStats = {
        interested: todayCalls.filter(c => c.outcome === 'INTERESTED').length,
        not_interested: todayCalls.filter(c => c.outcome === 'NOT_INTERESTED').length,
        no_answer: todayCalls.filter(c => c.outcome === 'NO_ANSWER').length,
        callback: todayCalls.filter(c => c.outcome === 'CALLBACK').length,
    };

    // Get calls by dentist ID
    const callsByDentist = new Map(todayCalls.map(c => [c.dentist_id, c]));

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white pb-24">
            {/* Header */}
            <header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="font-bold">DentCall</h1>
                                <p className="text-sm text-slate-400">{user?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <LanguageSwitcher />
                            <button
                                onClick={handleLogout}
                                className="text-slate-400 hover:text-white p-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">{t('progress')}</span>
                            <span className="text-white font-medium">{completedCount} / {assignments.length}</span>
                        </div>
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header >

            {/* Main Content */}
            < main className="max-w-2xl mx-auto px-4 py-6 space-y-4" >
                {
                    assignments.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📋</div>
                            <h2 className="text-xl font-semibold mb-2">{t('no_assignments')}</h2>
                            <p className="text-slate-400">Check back later or contact your admin</p>
                        </div>
                    ) : (
                        assignments.map((assignment) => {
                            const call = callsByDentist.get(assignment.dentist_id);
                            const isCompleted = !!call;
                            const isActive = activeCard === assignment.dentist_id;
                            const isEditing = editingCall === call?.id;
                            const outcomeStyle = call ? getOutcomeStyle(call.outcome) : null;

                            return (
                                <div
                                    key={assignment.id}
                                    className={`rounded-xl border-2 transition-all overflow-hidden ${isCompleted && outcomeStyle
                                        ? `${outcomeStyle.bg} ${outcomeStyle.border}`
                                        : isActive
                                            ? 'bg-slate-800 border-cyan-500'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    {/* Card Header */}
                                    <div
                                        className="p-4 cursor-pointer"
                                        onClick={() => {
                                            if (isCompleted && !isEditing) {
                                                setEditingCall(editingCall === call?.id ? null : call?.id || null);
                                                setActiveCard(assignment.dentist_id);
                                                if (call?.notes) {
                                                    setNotes({ ...notes, [assignment.dentist_id]: call.notes });
                                                }
                                            } else {
                                                setActiveCard(isActive ? null : assignment.dentist_id);
                                            }
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {isCompleted && outcomeStyle && (
                                                        <span className="text-lg">{OUTCOMES.find(o => o.value === call?.outcome)?.emoji}</span>
                                                    )}
                                                    <h3 className={`font-semibold truncate ${isCompleted ? outcomeStyle?.text : 'text-white'}`}>
                                                        {assignment.facility_name}
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-slate-400 mt-1">
                                                    {assignment.region} • {assignment.cities_served}
                                                </p>
                                                {assignment.manager && (
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        Manager: {assignment.manager}
                                                    </p>
                                                )}
                                            </div>
                                            {isCompleted && call && (
                                                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${outcomeStyle?.bg} ${outcomeStyle?.text} border ${outcomeStyle?.border}`}>
                                                    {t(OUTCOMES.find(o => o.value === call.outcome)?.key as any)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Phone Numbers */}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {assignment.phones.map((phone, idx) => (
                                                <a
                                                    key={idx}
                                                    href={`tel:${phone}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    {phone}
                                                </a>
                                            ))}
                                        </div>

                                        {/* Show notes if completed */}
                                        {isCompleted && call?.notes && !isEditing && (
                                            <div className="mt-3 text-sm text-slate-400 italic">
                                                &quot;{call.notes}&quot;
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded Section - New Call or Edit */}
                                    {(isActive && !isCompleted) || isEditing ? (
                                        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
                                            {isEditing && (
                                                <div className="text-xs text-amber-400 font-medium">✏️ Editing call outcome</div>
                                            )}

                                            {/* Notes */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                                    {t('notes_placeholder')}
                                                </label>
                                                <textarea
                                                    value={notes[assignment.dentist_id] || ''}
                                                    onChange={(e) => setNotes({ ...notes, [assignment.dentist_id]: e.target.value })}
                                                    placeholder={t('notes_placeholder')}
                                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 resize-none"
                                                    rows={2}
                                                />
                                            </div>

                                            {/* Outcome Buttons */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                                    {t('call_outcome')}
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {OUTCOMES.map((outcome) => (
                                                        <button
                                                            key={outcome.value}
                                                            onClick={() => {
                                                                if (isEditing && call?.id) {
                                                                    handleEditCall(call.id, assignment.dentist_id, outcome.value);
                                                                } else {
                                                                    handleLogCall(assignment.dentist_id, outcome.value);
                                                                }
                                                            }}
                                                            disabled={submitting === assignment.dentist_id}
                                                            className={`p-3 rounded-lg border-2 text-sm font-medium transition flex items-center justify-center gap-2 
                              ${call?.outcome === outcome.value ? `${outcome.bg} ${outcome.border} ${outcome.text}` : ''}
                              ${outcome.color === 'emerald' ? 'border-emerald-500/50 hover:bg-emerald-500/20 text-emerald-400' :
                                                                    outcome.color === 'red' ? 'border-red-500/50 hover:bg-red-500/20 text-red-400' :
                                                                        outcome.color === 'amber' ? 'border-amber-500/50 hover:bg-amber-500/20 text-amber-400' :
                                                                            outcome.color === 'cyan' ? 'border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-400' :
                                                                                'border-slate-500/50 hover:bg-slate-500/20 text-slate-400'
                                                                } disabled:opacity-50`}
                                                        >
                                                            <span>{outcome.emoji}</span>
                                                            <span>{t(outcome.key as any)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {isEditing && (
                                                <button
                                                    onClick={() => {
                                                        setEditingCall(null);
                                                        setActiveCard(null);
                                                    }}
                                                    className="text-sm text-slate-400 hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })
                    )
                }
            </main>

            {/* Bottom Stats Bar (Mobile) - With Outcome Colors */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-lg border-t border-slate-700 p-4">
                <div className="max-w-2xl mx-auto flex justify-around text-center">
                    <div>
                        <div className="text-xl font-bold text-emerald-400">{outcomeStats.interested}</div>
                        <div className="text-xs text-emerald-400/70">✅ Interested</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-red-400">{outcomeStats.not_interested}</div>
                        <div className="text-xs text-red-400/70">❌ Not Int.</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-slate-400">{outcomeStats.no_answer}</div>
                        <div className="text-xs text-slate-500">📵 No Ans.</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-amber-400">{outcomeStats.callback}</div>
                        <div className="text-xs text-amber-400/70">📞 Callback</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white">{assignments.length - completedCount}</div>
                        <div className="text-xs text-slate-500">Remaining</div>
                    </div>
                </div>
            </div >
        </div >
    );
}
