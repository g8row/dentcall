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
    preferred_caller_id?: string;
    wants_implants?: number;
    eik?: string;
    notes?: string;
    last_outcome?: string;
    last_call_id?: string;
    call_notes?: string;
    last_called_at?: string;
}

interface CallLog {
    id?: string;
    dentist_id: string;
    outcome: string;
    notes: string | null;
    called_at: string;
}

const OUTCOMES = [
    { value: 'INTERESTED', key: 'interested', emoji: '✅', color: 'emerald', bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
    { value: 'NOT_INTERESTED', key: 'not_interested', emoji: '❌', color: 'red', bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
    { value: 'NO_ANSWER', key: 'no_answer', emoji: '📵', color: 'slate', bg: 'bg-slate-600/30', border: 'border-slate-500', text: 'text-slate-400' },
    { value: 'CALLBACK', key: 'callback', emoji: '📞', color: 'amber', bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
    { value: 'ORDER_TAKEN', key: 'order_taken', emoji: '📦', color: 'cyan', bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400' },
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
    const [addingPhone, setAddingPhone] = useState<string | null>(null);
    const [newPhone, setNewPhone] = useState('');
    const [implantStatus, setImplantStatus] = useState<Record<string, boolean>>({});

    // History & Tabs State
    const [viewMode, setViewMode] = useState<'todo' | 'history'>('todo');
    const [historyAssignments, setHistoryAssignments] = useState<Assignment[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showStats, setShowStats] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [statsExpanded, setStatsExpanded] = useState(true);

    // EIK Editing State
    const [editingEikId, setEditingEikId] = useState<string | null>(null);
    const [eikValue, setEikValue] = useState('');

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

        // Initialize implant status and draft notes from assignments
        const implants: Record<string, boolean> = {};
        const draftNotes: Record<string, string> = {};

        (assignmentsData.assignments || []).forEach((a: Assignment) => {
            implants[a.dentist_id] = !!a.wants_implants;
            if (a.notes) {
                draftNotes[a.dentist_id] = a.notes;
            }
        });
        setImplantStatus(implants);
        setNotes(prev => ({ ...prev, ...draftNotes }));
    }, [today]);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/assignments?mode=history');
            const data = await res.json();
            setHistoryAssignments(data.assignments || []);

            // Should we update notes/implants from history too? 
            // Maybe not essential for the list view, but helpful if they edit
            const implants: Record<string, boolean> = { ...implantStatus };
            const draftNotes: Record<string, string> = { ...notes };

            (data.assignments || []).forEach((a: Assignment) => {
                implants[a.dentist_id] = !!a.wants_implants;
                if (a.notes) {
                    draftNotes[a.dentist_id] = a.notes;
                }
            });
            setImplantStatus(implants);
            setNotes(prev => ({ ...prev, ...draftNotes }));

        } finally {
            setHistoryLoading(false);
        }
    }, [implantStatus, notes]); // Depend on current state to merge

    useEffect(() => {
        if (viewMode === 'history') {
            loadHistory();
        }
    }, [viewMode]);

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
                // Prepend new call so it's found first by .find()
                setTodayCalls([{
                    id: data.id,
                    dentist_id: dentistId,
                    outcome,
                    notes: notes[dentistId] || '',
                    called_at: new Date().toISOString(),
                }, ...todayCalls]);
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
            // Create a NEW call record to preserve history
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

                // Prepend the new call so it overrides the old one in UI (since .find returns first match)
                setTodayCalls([{
                    id: data.id,
                    dentist_id: dentistId,
                    outcome,
                    notes: notes[dentistId] || null,
                    called_at: new Date().toISOString(),
                }, ...todayCalls]);

                setEditingCall(null);
                setActiveCard(null);
                setNotes({ ...notes, [dentistId]: '' });
            }
        } finally {
            setSubmitting(null);
        }
    };

    const completedCount = assignments.filter(a => a.completed).length;
    const progress = assignments.length > 0 ? (completedCount / assignments.length) * 100 : 0;

    // Get unique latest calls per dentist for stats and UI
    const latestCallsMap = new Map<string, CallLog>();
    todayCalls.forEach(c => {
        if (!latestCallsMap.has(c.dentist_id)) {
            latestCallsMap.set(c.dentist_id, c);
        }
    });
    const uniqueCalls = Array.from(latestCallsMap.values());

    // Outcome stats (based on unique latest status)
    const outcomeStats = {
        interested: uniqueCalls.filter(c => c.outcome === 'INTERESTED').length,
        not_interested: uniqueCalls.filter(c => c.outcome === 'NOT_INTERESTED').length,
        no_answer: uniqueCalls.filter(c => c.outcome === 'NO_ANSWER').length,
        callback: uniqueCalls.filter(c => c.outcome === 'CALLBACK').length,
        order_taken: uniqueCalls.filter(c => c.outcome === 'ORDER_TAKEN').length,
    };

    const handleUpdateEik = async (dentistId: string) => {
        try {
            const response = await fetch(`/api/dentists/${dentistId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eik: eikValue }),
            });

            if (!response.ok) throw new Error('Failed to update EIK');

            // Update local state
            setAssignments(prev => prev.map(a =>
                a.dentist_id === dentistId ? { ...a, eik: eikValue } : a
            ));
            setHistoryAssignments(prev => prev.map(a =>
                a.dentist_id === dentistId ? { ...a, eik: eikValue } : a
            ));
            setEditingEikId(null);
            setEikValue('');
        } catch (error) {
            console.error('Error updating EIK:', error);
            alert('Failed to update EIK');
        }
    };

    // Get calls by dentist ID (already have the map)
    const callsByDentist = latestCallsMap;

    // Search Filtering for History
    const filteredHistory = historyAssignments.filter(a => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const phones = a.phones.join(' ');
        return (
            a.facility_name.toLowerCase().includes(term) ||
            phones.includes(term) ||
            (a.manager && a.manager.toLowerCase().includes(term))
        );
    });

    const currentList = viewMode === 'todo' ? assignments : filteredHistory;



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
            <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
                {viewMode === 'history' && (
                    <div className="sticky top-[73px] z-40 pb-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            />
                            <div className="absolute right-3 top-3 text-slate-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {
                    historyLoading && viewMode === 'history' ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                            <p className="text-slate-400">{t('loading_history')}</p>
                        </div>
                    ) : currentList.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">{viewMode === 'todo' ? '📋' : '🕰️'}</div>
                            <h2 className="text-xl font-semibold mb-2">{viewMode === 'todo' ? t('no_assignments') : t('no_history')}</h2>
                            <p className="text-slate-400">{viewMode === 'todo' ? t('check_back_later') : t('no_history_desc')}</p>
                        </div>
                    ) : (
                        currentList.map((assignment) => {
                            let call = callsByDentist.get(assignment.dentist_id);

                            // If no call today, but we have history, use that
                            if (!call && assignment.last_call_id) {
                                call = {
                                    id: assignment.last_call_id,
                                    dentist_id: assignment.dentist_id,
                                    outcome: assignment.last_outcome!,
                                    notes: assignment.call_notes || null,
                                    called_at: assignment.last_called_at!
                                };
                            }

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
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {isCompleted && outcomeStyle && (
                                                        <span className="text-lg">{OUTCOMES.find(o => o.value === call?.outcome)?.emoji}</span>
                                                    )}
                                                    <h3 className={`font-semibold ${isCompleted ? outcomeStyle?.text : 'text-white'}`}>
                                                        {assignment.facility_name}
                                                    </h3>
                                                    {assignment.preferred_caller_id === user?.id && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wide ml-2 shrink-0">
                                                            {t('preferred_badge')}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-400 mt-1">
                                                    {assignment.region} • {(() => {
                                                        try {
                                                            const parsed = JSON.parse(assignment.cities_served);
                                                            return Array.isArray(parsed) ? parsed.join(', ') : assignment.cities_served;
                                                        } catch {
                                                            return assignment.cities_served;
                                                        }
                                                    })()}
                                                </p>
                                                {assignment.manager && (
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        {t('manager_prefix')} {assignment.manager}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    {editingEikId === assignment.dentist_id ? (
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={eikValue}
                                                                onChange={(e) => setEikValue(e.target.value)}
                                                                className="px-2 py-1 text-base bg-slate-900 border border-slate-600 rounded text-white w-32"
                                                                placeholder="EIK/BULSTAT"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => handleUpdateEik(assignment.dentist_id)}
                                                                className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 p-1 rounded"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingEikId(null)}
                                                                className="text-slate-400 hover:text-slate-300 bg-slate-700/50 p-1 rounded"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group/eik">
                                                            {assignment.eik ? (
                                                                <p className="text-sm text-slate-400 font-mono">
                                                                    EIK: {assignment.eik}
                                                                </p>
                                                            ) : (
                                                                <p className="text-sm text-slate-600 font-mono italic">
                                                                    No EIK
                                                                </p>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingEikId(assignment.dentist_id);
                                                                    setEikValue(assignment.eik || '');
                                                                }}
                                                                className="text-slate-500 hover:text-cyan-400 transition-colors p-1"
                                                                title="Edit EIK"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isCompleted && call && (
                                                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${outcomeStyle?.bg} ${outcomeStyle?.text} border ${outcomeStyle?.border}`}>
                                                    {t(OUTCOMES.find(o => o.value === call.outcome)?.key as any)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Phone Numbers and Implant Button Row */}
                                        <div className="mt-3 flex items-start justify-between gap-4">
                                            {/* Phones - left side, stacking */}
                                            <div className="flex flex-wrap gap-2 items-center flex-1">
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

                                                {/* Add Phone Button/Input */}
                                                {addingPhone === assignment.id ? (
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="tel"
                                                            value={newPhone}
                                                            onChange={(e) => setNewPhone(e.target.value)}
                                                            placeholder="+359..."
                                                            className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white w-28"
                                                            onKeyDown={async (e) => {
                                                                if (e.key === 'Enter' && newPhone.trim()) {
                                                                    const res = await fetch('/api/dentists', {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ dentist_id: assignment.dentist_id, add_phone: newPhone }),
                                                                    });
                                                                    if (res.ok) {
                                                                        loadData();
                                                                        setAddingPhone(null);
                                                                        setNewPhone('');
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                if (!newPhone.trim()) return;
                                                                const res = await fetch('/api/dentists', {
                                                                    method: 'PATCH',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ dentist_id: assignment.dentist_id, add_phone: newPhone }),
                                                                });
                                                                if (res.ok) {
                                                                    loadData();
                                                                    setAddingPhone(null);
                                                                    setNewPhone('');
                                                                }
                                                            }}
                                                            className="p-1 text-emerald-400 hover:text-emerald-300"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => { setAddingPhone(null); setNewPhone(''); }}
                                                            className="p-1 text-slate-400 hover:text-white"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAddingPhone(assignment.id); }}
                                                        className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-700/50 text-slate-400 rounded-lg text-sm hover:bg-slate-700 hover:text-white transition"
                                                        title="Add phone number"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Implant Toggle Button - Right side */}
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const newValue = !implantStatus[assignment.dentist_id];
                                                    setImplantStatus({ ...implantStatus, [assignment.dentist_id]: newValue });

                                                    await fetch('/api/dentists', {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ dentist_id: assignment.dentist_id, wants_implants: newValue }),
                                                    });
                                                }}
                                                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition border-2 ${implantStatus[assignment.dentist_id]
                                                    ? 'bg-purple-500/30 border-purple-500 text-purple-300'
                                                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-purple-500/50 hover:text-purple-300'
                                                    }`}
                                            >
                                                <span className="text-lg">🦷</span>
                                                <span>{t('implants_label')}</span>
                                                {implantStatus[assignment.dentist_id] && <span>✓</span>}
                                            </button>
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
                                                <div className="text-xs text-amber-400 font-medium">✏️ {t('editing_call')}</div>
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
                                                {/* Save Draft Button - Below Notes */}
                                                <button
                                                    onClick={async () => {
                                                        const note = notes[assignment.dentist_id];
                                                        if (note === undefined) return;

                                                        const res = await fetch('/api/assignments', {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                id: assignment.id,
                                                                notes: note
                                                            })
                                                        });

                                                        if (res.ok) {
                                                            alert(t('draft_saved'));
                                                        } else {
                                                            alert(t('save_draft_error'));
                                                        }
                                                    }}
                                                    className="w-full mt-2 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                                    title={t('save_draft_hint')}
                                                >
                                                    <span>💾</span> {t('save_draft')}
                                                </button>
                                            </div>

                                            {/* Outcome Buttons - Centered */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2 text-center">
                                                    {t('call_outcome')}
                                                </label>
                                                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
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
                                                            className={`p-3 rounded-lg border-2 text-sm font-medium transition flex items-center justify-center gap-2 w-[32%]
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
                                                    {t('cancel')}
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

            {/* Bottom Tabs & Stats */}
            <div className="fixed bottom-0 left-0 right-0 z-50">
                {/* Stats Toggle Button */}
                <div className="flex justify-center -mb-px">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="bg-slate-800 border-t border-x border-slate-700 rounded-t-lg px-4 py-1 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1"
                    >
                        <span>{showStats ? '▼' : '▲'}</span>
                        <span>{t('stats')}</span>
                    </button>
                </div>

                <div className="bg-slate-900/95 backdrop-blur-lg border-t border-slate-700 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
                    {/* Stats Row */}
                    {showStats && (
                        <div className="grid grid-cols-6 gap-0 py-3 border-b border-slate-800">
                            <div className="text-center border-r border-slate-800 last:border-0">
                                <div className="text-lg font-bold text-emerald-400 leading-none">{outcomeStats.interested}</div>
                                <div className="text-[10px] text-emerald-400/70 mt-1 font-medium">{t('interested')}</div>
                            </div>
                            <div className="text-center border-r border-slate-800 last:border-0">
                                <div className="text-lg font-bold text-red-400 leading-none">{outcomeStats.not_interested}</div>
                                <div className="text-[10px] text-red-400/70 mt-1 font-medium">{t('not_int_short')}</div>
                            </div>
                            <div className="text-center border-r border-slate-800 last:border-0">
                                <div className="text-lg font-bold text-slate-400 leading-none">{outcomeStats.no_answer}</div>
                                <div className="text-[10px] text-slate-500 mt-1 font-medium">{t('no_ans_short')}</div>
                            </div>
                            <div className="text-center border-r border-slate-800 last:border-0">
                                <div className="text-lg font-bold text-amber-400 leading-none">{outcomeStats.callback}</div>
                                <div className="text-[10px] text-amber-400/70 mt-1 font-medium">{t('callback')}</div>
                            </div>
                            <div className="text-center border-r border-slate-800 last:border-0">
                                <div className="text-lg font-bold text-cyan-400 leading-none">{outcomeStats.order_taken}</div>
                                <div className="text-[10px] text-cyan-400/70 mt-1 font-medium">{t('order_taken')}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-purple-400 leading-none">{Object.values(implantStatus).filter(Boolean).length}</div>
                                <div className="text-[10px] text-purple-400/70 mt-1 font-medium">{t('implants_label')}</div>
                            </div>
                        </div>
                    )}

                    {/* Tab Switcher */}
                    <div className="flex">
                        <button
                            onClick={() => {
                                setViewMode('todo');
                                loadData(); // Refresh todo list
                            }}
                            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${viewMode === 'todo'
                                ? 'bg-slate-800 text-white shadow-inner border-t-2 border-emerald-500'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                                }`}
                        >
                            <span className="text-lg">📋</span>
                            {t('today_calls')}
                            {assignments.length > 0 && <span className="px-2 py-0.5 bg-slate-700 rounded-full text-xs ml-1">{assignments.filter(a => !callsByDentist.has(a.dentist_id)).length}</span>}
                        </button>
                        <div className="w-px bg-slate-800"></div>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 ${viewMode === 'history'
                                ? 'bg-slate-800 text-white shadow-inner border-t-2 border-cyan-500'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                                }`}
                        >
                            <span className="text-lg">🕰️</span>
                            {t('history_log')}
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );
}
