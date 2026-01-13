'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import SchedulePlanner from '@/components/SchedulePlanner';
import StatsDashboard from '@/components/StatsDashboard';
import { useTranslation } from '@/lib/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AdminTutorial from '@/components/AdminTutorial';
import ConfirmModal from '@/components/ConfirmModal';

// ... (existing interfaces)

interface User {
    id: string;
    username: string;
    role: string;
    daily_target: number;
}

interface RegionInfo {
    region: string;
    dentist_count: number;
}

interface DayStats {
    regions: Record<string, number>;
    callers: Record<string, {
        total: number;
        completed: number;
        name: string;
        interested: number;
        not_interested: number;
        no_answer: number;
        callback: number;
        other: number;
    }>;
}

interface DayData {
    date: string;
    total: number;
    completed: number;
    stats?: DayStats;
    outcomes: {
        interested: number;
        not_interested: number;
        no_answer: number;
        callback: number;
        other: number;
    };
}

export default function AdminDashboard() {
    const router = useRouter();
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [viewDate, setViewDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [weekData, setWeekData] = useState<DayData[]>([]);
    const [regions, setRegions] = useState<RegionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDestructive: false,
    });

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // Schedule generation state
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [scheduleDays, setScheduleDays] = useState(7);
    const [scheduleStartDate, setScheduleStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [appendMode, setAppendMode] = useState(false);
    const [scheduleResult, setScheduleResult] = useState<{ message: string; region_breakdown?: Record<string, number> } | null>(null);

    const [newUser, setNewUser] = useState({ username: '', password: '', daily_target: 50 });
    const [activeTab, setActiveTab] = useState<'calendar' | 'users' | 'data' | 'stats'>('stats');
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Import state
    const [isImporting, setIsImporting] = useState(false);
    const [importStats, setImportStats] = useState<{ inserted: number; skipped: number; errors: number } | null>(null);


    const loadCalendarData = useCallback(async () => {
        try {
            setLoading(true);
            let start;

            if (viewMode === 'week') {
                start = startOfWeek(viewDate, { weekStartsOn: 1 });
            } else {
                start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
            }

            // We need to fetch enough data for the view
            const daysToFetch = viewMode === 'week' ? 7 : 42; // Max 6 weeks for month view
            const startDateStr = format(start, 'yyyy-MM-dd');

            // Fetch data for the range
            const res = await fetch(`/api/assignments?week=${startDateStr}&days=${daysToFetch}&stats=true`, { cache: 'no-store' });

            if (res.ok) {
                const data = await res.json();

                // Process the data into the array we expect
                const days: DayData[] = [];
                for (let i = 0; i < daysToFetch; i++) {
                    const current = addDays(start, i);
                    const dateStr = format(current, 'yyyy-MM-dd');
                    const dayStats = data.dayStats?.[dateStr];

                    let total = 0;
                    let completed = 0;
                    const outcomes = { interested: 0, not_interested: 0, no_answer: 0, callback: 0, other: 0 };

                    if (dayStats?.callers) {
                        Object.values(dayStats.callers).forEach((val: any) => {
                            const c = val as {
                                total: number;
                                completed: number;
                                interested: number;
                                not_interested: number;
                                no_answer: number;
                                callback: number;
                                other?: number;
                            };
                            total += c.total;
                            completed += c.completed;
                            outcomes.interested += c.interested || 0;
                            outcomes.not_interested += c.not_interested || 0;
                            outcomes.no_answer += c.no_answer || 0;
                            outcomes.callback += c.callback || 0;
                            outcomes.other += c.other || 0;
                        });
                    }

                    days.push({
                        date: dateStr,
                        total,
                        completed,
                        stats: dayStats,
                        outcomes: outcomes as { interested: number; not_interested: number; no_answer: number; callback: number; other: number },
                    });
                }
                setWeekData(days);
            }
        } catch (error) {
            console.error('Failed to load calendar data', error);
        } finally {
            setLoading(false);
        }
    }, [viewDate, viewMode]);

    // Load cities when regions change
    useEffect(() => {
        const loadCities = async () => {
            if (selectedRegions.length === 0) {
                setAvailableCities([]);
                return;
            }

            const allCities: string[] = [];
            for (const region of selectedRegions) {
                const res = await fetch(`/api/dentists/locations?region=${encodeURIComponent(region)}`);
                const data = await res.json();
                if (data.cities) {
                    allCities.push(...data.cities);
                }
            }
            setAvailableCities([...new Set(allCities)].sort());
        };

        loadCities();
    }, [selectedRegions]);

    useEffect(() => {
        const checkAuth = async () => {
            const res = await fetch('/api/auth/session');
            const data = await res.json();

            if (!data.authenticated || data.user.role !== 'ADMIN') {
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

        const loadData = async () => {
            const [usersRes, regionsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/dentists/locations'),
            ]);

            const usersData = await usersRes.json();
            const regionsData = await regionsRes.json();

            setUsers(usersData.users || []);
            setRegions(regionsData.regions || []);
        };

        loadData();
        loadData();
        loadCalendarData();

        // Auto-refresh every 60 seconds to show caller updates
        // Only refresh when schedule modal is NOT open and calendar tab is active
        const refreshInterval = setInterval(() => {
            if (!showScheduleModal && activeTab === 'calendar') {
                loadCalendarData();
            }
        }, 60000);

        return () => clearInterval(refreshInterval);
    }, [user, loadCalendarData, showScheduleModal, activeTab]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newUser, role: 'CALLER' }),
        });

        if (res.ok) {
            const data = await res.json();
            setUsers([...users, data.user]);
            setShowUserModal(false);
            setNewUser({ username: '', password: '', daily_target: 50 });
        }
    };

    const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
        await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
        setEditingUser(null);
    };

    const handleDeleteUser = async (userId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete User',
            message: 'Are you sure you want to delete this user? This action cannot be undone.',
            isDestructive: true,
            onConfirm: async () => {
                await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                setUsers(users.filter(u => u.id !== userId));
                closeConfirmModal();
            }
        });
    };

    const handleGenerateSchedule = async () => {
        setScheduleResult(null);

        const res = await fetch('/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_date: scheduleStartDate,
                days: scheduleDays,
                regions: selectedRegions.length > 0 ? selectedRegions : undefined,
                cities: selectedCities.length > 0 ? selectedCities : undefined,
                append: appendMode,
            }),
        });

        const data = await res.json();

        if (res.ok) {
            setScheduleResult({
                message: data.message,
                region_breakdown: data.region_breakdown,
            });
            loadCalendarData();
        } else {
            setScheduleResult({
                message: `Error: ${data.error}. Available: ${data.available_dentists || 0}`,
            });
        }
    };

    const handleDeleteSchedule = async (date: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Schedule',
            message: `Delete all assignments for ${date}? This will remove all call history for this day.`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/assignments?date=${date}`, { method: 'DELETE' });
                    if (res.ok) {
                        loadCalendarData();
                    } else {
                        const data = await res.json();
                        alert(`Failed to delete: ${data.error || 'Unknown error'}`);
                    }
                } catch (err) {
                    alert('Failed to delete schedule');
                    console.error(err);
                }
                closeConfirmModal();
            }
        });
    };

    const handleExport = (type: string) => {
        window.open(`/api/export?type=${type}`, '_blank');
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input immediately to allow re-selection of same file
        e.target.value = '';

        setConfirmModal({
            isOpen: true,
            title: 'Import Dentists',
            message: `Import ${file.name}? This process may take a while and will update the database.`,
            isDestructive: false,
            onConfirm: () => {
                setIsImporting(true);
                setImportStats(null);
                closeConfirmModal();

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const text = event.target?.result as string;
                        const json = JSON.parse(text);

                        const res = await fetch('/api/dentists/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(json),
                        });

                        if (res.status === 413) {
                            throw new Error('File too large. Please increase Nginx "client_max_body_size" limit.');
                        }

                        if (!res.ok) {
                            // Try to parse error JSON, fallback to status text
                            try {
                                const data = await res.json();
                                throw new Error(data.error || res.statusText);
                            } catch (e) {
                                throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
                            }
                        }

                        const data = await res.json();
                        setImportStats(data);

                    } catch (err: any) {
                        console.error(err);
                        alert(err.message || 'Failed to parse or upload file.');
                    } finally {
                        setIsImporting(false);
                        // Reset file input
                        e.target.value = '';
                    }
                };
                reader.readAsText(file);
            }
        });
    };

    const getProgressColor = (percent: number) => {
        if (percent >= 75) return 'bg-emerald-500';
        if (percent >= 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white" >
            {/* Header */}
            < header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-50" >
                <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold whitespace-nowrap">{t('admin_title')}</h1>
                            <p className="text-sm text-slate-400 hidden sm:block">{user?.username}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
                        <button
                            onClick={() => setShowTutorial(true)}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-bold animate-pulse shadow-lg shadow-indigo-500/50 flex items-center gap-1 shrink-0"
                        >
                            <span className="text-sm">🎓</span>
                            <span className="hidden sm:inline">{t('start_tutorial')}</span>
                            <span className="sm:hidden">Help</span>
                        </button>

                        <div className="shrink-0">
                            <LanguageSwitcher />
                        </div>

                        <button
                            onClick={() => router.push('/admin/campaigns')}
                            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition shrink-0 whitespace-nowrap"
                        >
                            <span className="hidden sm:inline">{t('campaigns')}</span>
                            <span className="sm:hidden">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition shrink-0"
                        >
                            <span className="hidden sm:inline">{t('logout')}</span>
                            <span className="sm:hidden">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </span>
                        </button>
                    </div>
                </div>
            </header >

            {/* Tabs */}
            < div className="max-w-7xl mx-auto px-4 py-4" >
                <div className="flex gap-2 border-b border-slate-700 pb-4 overflow-x-auto no-scrollbar flex-nowrap">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap shrink-0 ${activeTab === 'stats'
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {t('statistics')}
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap shrink-0 ${activeTab === 'calendar'
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {t('calendar')}
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap shrink-0 ${activeTab === 'users'
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {t('users')}
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap shrink-0 ${activeTab === 'data'
                            ? 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {t('data_export')}
                    </button>
                </div>
            </div >

            {/* Main Content */}
            < main className="max-w-7xl mx-auto px-4 pb-8" >
                {/* Stats Tab */}
                {activeTab === 'stats' && <StatsDashboard />}

                {/* Calendar Tab */}
                {
                    activeTab === 'calendar' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                        <button
                                            onClick={() => setViewMode('week')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'week' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Week
                                        </button>
                                        <button
                                            onClick={() => setViewMode('month')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'month' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Month
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
                                        <button
                                            onClick={() => setViewDate(prev => viewMode === 'week' ? addWeeks(prev, -1) : addMonths(prev, -1))}
                                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => setViewDate(new Date())}
                                            className="px-3 py-1 text-sm font-medium text-slate-300 hover:text-white transition border-x border-slate-700"
                                        >
                                            {t('today') || 'Today'}
                                        </button>
                                        <button
                                            onClick={() => setViewDate(prev => viewMode === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1))}
                                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <h2 className="text-xl font-bold text-white ml-2">
                                        {viewMode === 'week' ? (
                                            <>{t('week_of')} {format(viewDate, 'MMM d, yyyy')}</>
                                        ) : (
                                            <>{format(viewDate, 'MMMM yyyy')}</>
                                        )}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium transition"
                                >
                                    {t('schedule_planner')}
                                </button>
                            </div>

                            {/* Enhanced Calendar Grid */}
                            <div className={`grid gap-4 ${viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-7 auto-rows-fr'}`}>
                                {viewMode === 'month' && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2 hidden md:block">
                                        {day}
                                    </div>
                                ))}

                                {weekData.map((day) => {
                                    const percent = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
                                    const isCurrentMonth = viewMode === 'week' ? true : isSameMonth(new Date(day.date), viewDate);
                                    const isToday = format(new Date(), 'yyyy-MM-dd') === day.date;

                                    return (
                                        <div
                                            key={day.date}
                                            className={`bg-slate-800 rounded-xl border transition-all duration-200 group relative overflow-hidden cursor-pointer
                                                ${!isCurrentMonth ? 'opacity-40 bg-slate-900 border-slate-800' : ''}
                                                p-3 ${viewMode === 'month' ? 'min-h-[100px]' : 'p-4'} border-slate-700 hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-0.5
                                                ${isToday ? 'ring-1 ring-blue-500/50' : ''}
                                            `}
                                            onClick={() => setSelectedDay(day)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-baseline gap-1">
                                                    {viewMode === 'week' && (
                                                        <div className="text-xs text-slate-400 uppercase font-semibold">
                                                            {format(new Date(day.date), 'EEE')}
                                                        </div>
                                                    )}
                                                    <div className={`font-bold ${viewMode === 'week' ? 'text-2xl' : 'text-lg text-slate-300'}`}>
                                                        {format(new Date(day.date), 'd')}
                                                    </div>
                                                </div>
                                                {day.total > 0 && (
                                                    <div className={`font-bold ${viewMode === 'week' ? 'text-2xl' : 'text-xs'} ${percent >= 75 ? 'text-emerald-400' : percent >= 50 ? 'text-amber-400' : 'text-red-400'
                                                        }`}>
                                                        {percent}%
                                                    </div>
                                                )}
                                            </div>

                                            {day.total > 0 ? (
                                                <>
                                                    {/* Color-coded progress bar */}
                                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2 flex">
                                                        <div style={{ width: `${(day.outcomes.interested / day.total) * 100}%` }} className="h-full bg-emerald-500" title="Interested" />
                                                        <div style={{ width: `${(day.outcomes.not_interested / day.total) * 100}%` }} className="h-full bg-red-500" title="Not Interested" />
                                                        <div style={{ width: `${(day.outcomes.callback / day.total) * 100}%` }} className="h-full bg-amber-500" title="Callback/Follow-up" />
                                                        <div style={{ width: `${(day.outcomes.no_answer / day.total) * 100}%` }} className="h-full bg-slate-400" title="No Answer" />
                                                        <div style={{ width: `${(day.outcomes.other / day.total) * 100}%` }} className="h-full bg-slate-600" title="Other" />
                                                    </div>

                                                    {viewMode === 'week' && (
                                                        <div className="text-center text-sm text-slate-400 mb-2">
                                                            {day.completed} / {day.total} calls
                                                        </div>
                                                    )}

                                                    {/* Region breakdown - Simplified for Month View */}
                                                    {day.stats?.regions && (
                                                        <div className={`flex flex-col gap-1 ${viewMode === 'week' ? 'mt-3' : 'mt-1'}`}>
                                                            {Object.entries(day.stats.regions).slice(0, viewMode === 'week' ? 3 : 1).map(([region, count]) => (
                                                                <div key={region} className={`flex items-center justify-between text-xs px-1.5 py-0.5 bg-slate-700/50 rounded ${viewMode === 'week' ? 'hover:bg-slate-700' : ''}`}>
                                                                    <span className="text-slate-300 truncate max-w-[80px]" title={region}>
                                                                        {region}
                                                                    </span>
                                                                    <span className="text-slate-400 font-mono ml-1">{count}</span>
                                                                </div>
                                                            ))}
                                                            {Object.keys(day.stats.regions).length > (viewMode === 'week' ? 3 : 1) && (
                                                                <div className="text-[10px] text-center text-slate-500">
                                                                    +{Object.keys(day.stats.regions).length - (viewMode === 'week' ? 3 : 1)}...
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center text-sm text-slate-500">
                                                    {t('no_assignments')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Day Details Modal */}
                            {selectedDay && (
                                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                    <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-700 overflow-hidden animate-in fade-in zoom-in duration-200">
                                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                                            <div>
                                                <h3 className="text-xl font-bold text-white">
                                                    {format(new Date(selectedDay.date), 'EEEE, MMMM d')}
                                                </h3>
                                                <p className="text-sm text-slate-400">
                                                    {selectedDay.completed} / {selectedDay.total} calls completed
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedDay(null)}
                                                className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                            {selectedDay.total > 0 ? (
                                                <div className="space-y-6">
                                                    {/* Progress Bar */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Progress</span>
                                                            <span className="text-emerald-400 font-medium">
                                                                {Math.round((selectedDay.completed / selectedDay.total) * 100)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
                                                            <div style={{ width: `${(selectedDay.outcomes.interested / selectedDay.total) * 100}%` }} className="h-full bg-emerald-500" />
                                                            <div style={{ width: `${(selectedDay.outcomes.not_interested / selectedDay.total) * 100}%` }} className="h-full bg-red-500" />
                                                            <div style={{ width: `${(selectedDay.outcomes.callback / selectedDay.total) * 100}%` }} className="h-full bg-amber-500" />
                                                            <div style={{ width: `${(selectedDay.outcomes.no_answer / selectedDay.total) * 100}%` }} className="h-full bg-slate-400" />
                                                            <div style={{ width: `${(selectedDay.outcomes.other / selectedDay.total) * 100}%` }} className="h-full bg-slate-600" />
                                                        </div>
                                                        <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
                                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Interested</div>
                                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Not Interested</div>
                                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Callback</div>
                                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> No Answer</div>
                                                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600"></span> Other</div>
                                                        </div>
                                                    </div>

                                                    {/* Region Breakdown */}
                                                    {selectedDay.stats?.regions && (
                                                        <div className="space-y-3">
                                                            <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Regions</h4>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {Object.entries(selectedDay.stats.regions).map(([region, count]) => (
                                                                    <div key={region} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700">
                                                                        <span className="text-sm text-slate-300 truncate mr-2" title={region}>{region}</span>
                                                                        <span className="text-sm font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{count}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Caller Breakdown */}
                                                    {selectedDay.stats?.callers && (
                                                        <div className="space-y-3">
                                                            <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider">{t('per_caller')}</h4>
                                                            <div className="space-y-3">
                                                                {Object.entries(selectedDay.stats.callers).map(([, caller]) => (
                                                                    <div key={caller.name} className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/50">
                                                                        <div className="flex justify-between items-center mb-2">
                                                                            <span className="font-medium text-white">{caller.name}</span>
                                                                            <span className="text-xs text-slate-400">{caller.completed}/{caller.total} calls</span>
                                                                        </div>
                                                                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                                                                            <div style={{ width: `${caller.total > 0 ? (caller.interested / caller.total) * 100 : 0}%` }} className="h-full bg-emerald-500" />
                                                                            <div style={{ width: `${caller.total > 0 ? (caller.not_interested / caller.total) * 100 : 0}%` }} className="h-full bg-red-500" />
                                                                            <div style={{ width: `${caller.total > 0 ? (caller.callback / caller.total) * 100 : 0}%` }} className="h-full bg-amber-500" />
                                                                            <div style={{ width: `${caller.total > 0 ? (caller.no_answer / caller.total) * 100 : 0}%` }} className="h-full bg-slate-500" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-slate-500">
                                                    <p>{t('no_assignments')}</p>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDay(null);
                                                            setShowScheduleModal(true);
                                                        }}
                                                        className="mt-4 text-emerald-400 hover:text-emerald-300 underline"
                                                    >
                                                        Schedule Assignments
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-2">
                                            {selectedDay.total > 0 && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to delete all assignments for this day?')) {
                                                            handleDeleteSchedule(selectedDay.date);
                                                            setSelectedDay(null);
                                                        }
                                                    }}
                                                    className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                                >
                                                    {t('delete_day')}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedDay(null)}
                                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

                {/* Users Tab */}
                {
                    activeTab === 'users' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold">{t('users')}</h2>
                                <button
                                    onClick={() => setShowUserModal(true)}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium transition"
                                >
                                    {t('add_caller')}
                                </button>
                            </div>

                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-700/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('username')}</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('role')}</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('target')}</th>
                                            <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {users.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-700/30">
                                                <td className="px-4 py-3 text-white">{u.username}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                                                        }`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingUser?.id === u.id ? (
                                                        <input
                                                            type="number"
                                                            value={editingUser.daily_target}
                                                            onChange={(e) => setEditingUser({ ...editingUser, daily_target: parseInt(e.target.value) })}
                                                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-300">{u.daily_target}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {u.role !== 'ADMIN' && (
                                                        <div className="flex justify-end gap-2">
                                                            {editingUser?.id === u.id ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleUpdateUser(u.id, { daily_target: editingUser.daily_target })}
                                                                        className="text-emerald-400 hover:text-emerald-300"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingUser(null)}
                                                                        className="text-slate-400 hover:text-white"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => setEditingUser(u)}
                                                                        className="text-slate-400 hover:text-white"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(u.id)}
                                                                        className="text-red-400 hover:text-red-300"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }

                {/* Data Tab */}
                {
                    activeTab === 'data' && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold">Data Management</h2>

                            {importStats && (
                                <div className="bg-slate-800 border border-emerald-500/50 rounded-xl p-4 mb-6">
                                    <h3 className="tex-lg font-medium text-emerald-400 mb-2">Import Complete</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="bg-slate-900/50 p-3 rounded-lg">
                                            <div className="text-2xl font-bold text-white">{importStats.inserted}</div>
                                            <div className="text-sm text-slate-400">Inserted</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded-lg">
                                            <div className="text-2xl font-bold text-amber-400">{importStats.skipped}</div>
                                            <div className="text-sm text-slate-400">Duplicate/Skipped</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded-lg">
                                            <div className="text-2xl font-bold text-red-400">{importStats.errors}</div>
                                            <div className="text-sm text-slate-400">Errors</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setImportStats(null)}
                                        className="mt-4 text-sm text-slate-400 hover:text-white underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Import Card */}
                                <div className="p-6 bg-slate-800 rounded-xl border border-dashed border-slate-600 hover:border-emerald-500 transition text-left relative group">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleImport}
                                        disabled={isImporting}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                                    />
                                    <div className="text-emerald-400 text-2xl mb-2">
                                        {isImporting ? (
                                            <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                                        ) : (
                                            '📥'
                                        )}
                                    </div>
                                    <h3 className="font-semibold mb-1">
                                        {isImporting ? 'Importing...' : t('import_dentists') || 'Import Dentists'}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Drag & drop JSON file here or click to upload
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleExport('dentists')}
                                    className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500 transition text-left"
                                >
                                    <div className="text-emerald-400 text-2xl mb-2">📋</div>
                                    <h3 className="font-semibold mb-1">{t('export_dentists')}</h3>
                                    <p className="text-sm text-slate-400">Export all dentist records with call history</p>
                                </button>

                                <button
                                    onClick={() => handleExport('calls')}
                                    className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500 transition text-left"
                                >
                                    <div className="text-cyan-400 text-2xl mb-2">📞</div>
                                    <h3 className="font-semibold mb-1">{t('export_calls')}</h3>
                                    <p className="text-sm text-slate-400">Export all call records with outcomes</p>
                                </button>

                                <button
                                    onClick={() => handleExport('stats')}
                                    className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500 transition text-left"
                                >
                                    <div className="text-purple-400 text-2xl mb-2">📊</div>
                                    <h3 className="font-semibold mb-1">{t('export_stats')}</h3>
                                    <p className="text-sm text-slate-400">Export performance statistics by caller</p>
                                </button>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* Add User Modal */}
            {
                showUserModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
                            <h3 className="text-lg font-semibold mb-4">Add New Caller</h3>
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Daily Target</label>
                                    <input
                                        type="number"
                                        value={newUser.daily_target}
                                        onChange={(e) => setNewUser({ ...newUser, daily_target: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                        required
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowUserModal(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium"
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Enhanced Schedule Planner */}
            {
                showScheduleModal && (
                    <SchedulePlanner
                        onClose={() => setShowScheduleModal(false)}
                        onScheduleGenerated={() => {
                            loadWeekData();
                        }}
                    />
                )
            }

            {/* Tutorial Modal */}
            {
                showTutorial && (
                    <AdminTutorial onClose={() => setShowTutorial(false)} />
                )
            }

            {/* Confirmation Modal */}
            <ConfirmModal
                {...confirmModal}
                onCancel={closeConfirmModal}
            />

        </div >
    );
}
