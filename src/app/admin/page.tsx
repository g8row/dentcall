'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
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
    };
}

export default function AdminDashboard() {
    const router = useRouter();
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [weekData, setWeekData] = useState<DayData[]>([]);
    const [regions, setRegions] = useState<RegionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
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


    const loadWeekData = useCallback(async () => {
        const res = await fetch(`/api/assignments?week=${format(weekStart, 'yyyy-MM-dd')}&stats=true`, { cache: 'no-store' });
        const data = await res.json();

        const days: DayData[] = [];
        for (let i = 0; i < 7; i++) {
            const date = format(addDays(weekStart, i), 'yyyy-MM-dd');
            const dayStats = data.dayStats?.[date];

            let total = 0;
            let completed = 0;
            const outcomes = { interested: 0, not_interested: 0, no_answer: 0, callback: 0 };

            if (dayStats?.callers) {
                Object.values(dayStats.callers).forEach((val: any) => {
                    const c = val as {
                        total: number;
                        completed: number;
                        interested: number;
                        not_interested: number;
                        no_answer: number;
                        callback: number;
                    };
                    total += c.total;
                    completed += c.completed;
                    outcomes.interested += c.interested || 0;
                    outcomes.not_interested += c.not_interested || 0;
                    outcomes.no_answer += c.no_answer || 0;
                    outcomes.callback += c.callback || 0;
                });
            }

            days.push({
                date,
                total,
                completed,
                stats: dayStats,
                outcomes,
            });
        }
        setWeekData(days);
    }, [weekStart]);

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
        loadWeekData();

        // Auto-refresh every 60 seconds to show caller updates
        // Only refresh when schedule modal is NOT open and calendar tab is active
        const refreshInterval = setInterval(() => {
            if (!showScheduleModal && activeTab === 'calendar') {
                loadWeekData();
            }
        }, 60000);

        return () => clearInterval(refreshInterval);
    }, [user, loadWeekData, showScheduleModal, activeTab]);

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
            loadWeekData();
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
                        loadWeekData();
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

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto mask-fade-right">
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
                <div className="flex gap-2 border-b border-slate-700 pb-4 overflow-x-auto no-scrollbar mask-fade-right flex-nowrap">
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
                                    <button
                                        onClick={() => setWeekStart(subWeeks(weekStart, 1))}
                                        className="p-2 hover:bg-slate-800 rounded-lg transition"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <h2 className="text-lg font-semibold">
                                        {t('week_of')} {format(weekStart, 'MMM d, yyyy')}
                                    </h2>
                                    <button
                                        onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                                        className="p-2 hover:bg-slate-800 rounded-lg transition"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium transition"
                                >
                                    {t('schedule_planner')}
                                </button>
                            </div>

                            {/* Enhanced Calendar Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                                {weekData.map((day) => {
                                    const percent = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
                                    const isExpanded = expandedDay === day.date;

                                    return (
                                        <div
                                            key={day.date}
                                            className={`bg-slate-800 rounded-xl p-4 border cursor-pointer transition-all ${isExpanded ? 'border-emerald-500 md:col-span-2' : 'border-slate-700 hover:border-slate-600'
                                                }`}
                                            onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <div className="text-sm text-slate-400">
                                                        {format(new Date(day.date), 'EEE')}
                                                    </div>
                                                    <div className="text-2xl font-bold">
                                                        {format(new Date(day.date), 'd')}
                                                    </div>
                                                </div>
                                                {day.total > 0 && (
                                                    <div className={`text-2xl font-bold ${percent >= 75 ? 'text-emerald-400' : percent >= 50 ? 'text-amber-400' : 'text-red-400'
                                                        }`}>
                                                        {percent}%
                                                    </div>
                                                )}
                                            </div>

                                            {day.total > 0 ? (
                                                <>
                                                    {/* Color-coded progress bar */}
                                                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-2 flex">
                                                        <div style={{ width: `${(day.outcomes.interested / day.total) * 100}%` }} className="h-full bg-emerald-500" title="Interested" />
                                                        <div style={{ width: `${(day.outcomes.not_interested / day.total) * 100}%` }} className="h-full bg-red-500" title="Not Interested" />
                                                        <div style={{ width: `${(day.outcomes.callback / day.total) * 100}%` }} className="h-full bg-amber-500" title="Callback/Follow-up" />
                                                        <div style={{ width: `${(day.outcomes.no_answer / day.total) * 100}%` }} className="h-full bg-slate-500" title="No Answer" />
                                                    </div>
                                                    <div className="text-center text-sm text-slate-400 mb-2">
                                                        {day.completed} / {day.total} calls
                                                    </div>

                                                    {/* Region breakdown */}
                                                    {day.stats?.regions && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {Object.entries(day.stats.regions).slice(0, isExpanded ? undefined : 2).map(([region, count]) => (
                                                                <span key={region} className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                                                                    {region.slice(0, 6)}… {count}
                                                                </span>
                                                            ))}
                                                            {!isExpanded && Object.keys(day.stats.regions).length > 2 && (
                                                                <span className="text-xs text-slate-500">+{Object.keys(day.stats.regions).length - 2}</span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Expanded view - caller breakdown */}
                                                    {isExpanded && day.stats?.callers && (
                                                        <div className="mt-4 space-y-2 border-t border-slate-700 pt-3">
                                                            <div className="text-xs font-medium text-slate-400 uppercase">{t('per_caller')}</div>
                                                            {Object.entries(day.stats.callers).map(([, caller]) => {
                                                                const callerPercent = caller.total > 0 ? Math.round((caller.completed / caller.total) * 100) : 0;
                                                                return (
                                                                    <div key={caller.name} className="flex items-center gap-2">
                                                                        <span className="text-sm text-white w-20 truncate">{caller.name}</span>
                                                                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden flex">
                                                                            <div style={{ width: `${(caller.interested / caller.total) * 100}%` }} className="h-full bg-emerald-500" />
                                                                            <div style={{ width: `${(caller.not_interested / caller.total) * 100}%` }} className="h-full bg-red-500" />
                                                                            <div style={{ width: `${(caller.callback / caller.total) * 100}%` }} className="h-full bg-amber-500" />
                                                                            <div style={{ width: `${(caller.no_answer / caller.total) * 100}%` }} className="h-full bg-slate-500" />
                                                                        </div>
                                                                        <span className="text-xs text-slate-400">{caller.completed}/{caller.total}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteSchedule(day.date);
                                                                }}
                                                                className="mt-2 text-xs text-red-400 hover:text-red-300"
                                                            >
                                                                {t('delete_day')}
                                                            </button>
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
