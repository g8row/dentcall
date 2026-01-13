'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/translations';
import { format } from 'date-fns';

interface DashboardData {
    overview: {
        total_dentists: number;
        total_calls: number;
        interested_rate: number;
        active_callers: number;
        today_calls: number;
        today_capacity: number;
        overall_coverage: number;
        pending_callbacks: number;
    };
    regions: Array<{
        region: string;
        total: number;
        called: number;
        coverage_percent: number;
        interested: number;
        not_interested: number;
        no_answer: number;
        callback: number;
        interest_rate: number;
    }>;
    daily_stats: Array<{
        date: string;
        total: number;
        interested: number;
        not_interested: number;
        no_answer: number;
        callback: number;
        other: number;
    }>;
    outcomes: {
        interested: number;
        not_interested: number;
        no_answer: number;
        callback: number;
        follow_up: number;
    };
    recent_calls: Array<{
        id: string;
        called_at: string;
        caller_name: string;
        facility_name: string;
        region: string;
        outcome: string;
        notes: string | null;
    }>;
    weekly: {
        this_week: number;
        last_week: number;
        change_percent: number;
    };
    top_regions: Array<{
        region: string;
        interest_rate: number;
    }>;
}

export default function StatsDashboard() {
    const { t } = useTranslation();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [regionSort, setRegionSort] = useState<'name' | 'coverage' | 'interest'>('coverage');
    const [regionSortDir, setRegionSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch('/api/stats/dashboard');
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error('Failed to load dashboard stats:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
        const interval = setInterval(loadData, 120000); // Refresh every 2 minutes
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12 text-slate-400">
                {t('no_data')}
            </div>
        );
    }

    const totalOutcomes = data.outcomes.interested + data.outcomes.not_interested +
        data.outcomes.no_answer + data.outcomes.callback + data.outcomes.follow_up;

    const outcomePercent = (count: number) => totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0;

    // Sort regions
    const sortedRegions = [...data.regions].sort((a, b) => {
        let aVal: number | string, bVal: number | string;
        if (regionSort === 'name') {
            aVal = a.region;
            bVal = b.region;
        } else if (regionSort === 'coverage') {
            aVal = a.coverage_percent;
            bVal = b.coverage_percent;
        } else {
            aVal = a.interest_rate;
            bVal = b.interest_rate;
        }
        if (typeof aVal === 'string') {
            return regionSortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
        }
        return regionSortDir === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    const handleRegionSort = (col: 'name' | 'coverage' | 'interest') => {
        if (regionSort === col) {
            setRegionSortDir(regionSortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setRegionSort(col);
            setRegionSortDir('desc');
        }
    };

    // Get max daily calls for chart scaling
    const maxDailyTotal = Math.max(...data.daily_stats.map(d => d.total), 1);

    // Create outcome donut chart using conic-gradient
    const interestedDeg = (data.outcomes.interested / totalOutcomes) * 360 || 0;
    const notInterestedDeg = (data.outcomes.not_interested / totalOutcomes) * 360 || 0;
    const noAnswerDeg = (data.outcomes.no_answer / totalOutcomes) * 360 || 0;
    const callbackDeg = ((data.outcomes.callback + data.outcomes.follow_up) / totalOutcomes) * 360 || 0;

    const donutGradient = `conic-gradient(
        #10b981 0deg ${interestedDeg}deg,
        #ef4444 ${interestedDeg}deg ${interestedDeg + notInterestedDeg}deg,
        #64748b ${interestedDeg + notInterestedDeg}deg ${interestedDeg + notInterestedDeg + noAnswerDeg}deg,
        #f59e0b ${interestedDeg + notInterestedDeg + noAnswerDeg}deg 360deg
    )`;

    const getOutcomeColor = (outcome: string) => {
        switch (outcome) {
            case 'INTERESTED': return 'bg-emerald-500/20 text-emerald-400';
            case 'NOT_INTERESTED': return 'bg-red-500/20 text-red-400';
            case 'NO_ANSWER': return 'bg-slate-500/20 text-slate-400';
            case 'CALLBACK':
            case 'FOLLOW_UP': return 'bg-amber-500/20 text-amber-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm">{t('total_dentists')}</div>
                    <div className="text-2xl font-bold text-white mt-1">{data.overview.total_dentists.toLocaleString()}</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm">{t('total_calls')}</div>
                    <div className="text-2xl font-bold text-white mt-1">{data.overview.total_calls.toLocaleString()}</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm">{t('interested_rate')}</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{data.overview.interested_rate}%</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm">{t('coverage_rate')}</div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">{data.overview.overall_coverage}%</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm">{t('today_progress')}</div>
                    <div className="text-2xl font-bold text-white mt-1">
                        {data.overview.today_calls}
                        <span className="text-sm text-slate-400 font-normal">/{data.overview.today_capacity}</span>
                    </div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm">{t('pending_callbacks')}</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">{data.overview.pending_callbacks}</div>
                </div>
            </div>

            {/* Weekly Comparison & Top Regions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4">{t('weekly_comparison')}</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-slate-400 text-sm">{t('this_week')}</div>
                            <div className="text-2xl font-bold text-white">{data.weekly.this_week}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-slate-400 text-sm">{t('last_week')}</div>
                            <div className="text-2xl font-bold text-white">{data.weekly.last_week}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-slate-400 text-sm">{t('change')}</div>
                            <div className={`text-2xl font-bold ${data.weekly.change_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data.weekly.change_percent >= 0 ? '+' : ''}{data.weekly.change_percent}%
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4">{t('top_regions')}</h3>
                    <div className="space-y-2">
                        {data.top_regions.length > 0 ? data.top_regions.map((r, i) => (
                            <div key={r.region} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' :
                                        i === 1 ? 'bg-slate-300 text-black' :
                                            'bg-amber-700 text-white'
                                        }`}>
                                        {i + 1}
                                    </span>
                                    <span className="text-white">{r.region}</span>
                                </div>
                                <span className="text-emerald-400 font-semibold">{r.interest_rate}%</span>
                            </div>
                        )) : (
                            <div className="text-slate-400 text-center py-4">{t('no_data')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Daily Activity Chart & Outcome Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Daily Activity */}
                <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-5 border-b border-slate-700">
                        <h3 className="text-lg font-semibold">{t('daily_activity')} <span className="text-sm text-slate-400 font-normal">({t('last_30_days')})</span></h3>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-700/50 text-xs uppercase text-slate-400 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium text-center">Calls</th>
                                    <th className="px-4 py-3 font-medium text-center">Interested</th>
                                    <th className="px-4 py-3 font-medium text-center">Success Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {data.daily_stats.slice().reverse().map(day => {
                                    const successRate = day.total > 0 ? Math.round((day.interested / day.total) * 100) : 0;
                                    return (
                                        <tr key={day.date} className="hover:bg-slate-700/30 transition">
                                            <td className="px-4 py-3 text-slate-300 font-medium">
                                                {format(new Date(day.date), 'MMM d, yyyy')}
                                            </td>
                                            <td className="px-4 py-3 text-center text-white">
                                                {day.total}
                                            </td>
                                            <td className="px-4 py-3 text-center text-emerald-400 font-medium">
                                                {day.interested}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${successRate >= 20 ? 'bg-emerald-500/20 text-emerald-400' :
                                                    successRate >= 10 ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {successRate}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {data.daily_stats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                            {t('no_data')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Outcome Distribution Donut */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h3 className="text-lg font-semibold mb-4">{t('outcome_distribution')}</h3>
                    <div className="flex flex-col items-center">
                        <div
                            className="w-40 h-40 rounded-full relative"
                            style={{ background: donutGradient }}
                        >
                            <div className="absolute inset-4 bg-slate-800 rounded-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{totalOutcomes}</div>
                                    <div className="text-xs text-slate-400">{t('calls')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-emerald-500 rounded"></span>
                                <span className="text-slate-300">{t('interested')}</span>
                                <span className="text-white font-semibold">{outcomePercent(data.outcomes.interested)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-red-500 rounded"></span>
                                <span className="text-slate-300">{t('not_interested')}</span>
                                <span className="text-white font-semibold">{outcomePercent(data.outcomes.not_interested)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-slate-500 rounded"></span>
                                <span className="text-slate-300">{t('no_answer')}</span>
                                <span className="text-white font-semibold">{outcomePercent(data.outcomes.no_answer)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-amber-500 rounded"></span>
                                <span className="text-slate-300">{t('callback')}</span>
                                <span className="text-white font-semibold">{outcomePercent(data.outcomes.callback + data.outcomes.follow_up)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Region Coverage Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold">{t('region_coverage')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-700/70"
                                    onClick={() => handleRegionSort('name')}
                                >
                                    {t('region')} {regionSort === 'name' && (regionSortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">{t('dentists')}</th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">{t('called')}</th>
                                <th
                                    className="px-4 py-3 text-left text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-700/70"
                                    onClick={() => handleRegionSort('coverage')}
                                >
                                    {t('coverage')} {regionSort === 'coverage' && (regionSortDir === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                                    <span className="inline-block w-3 h-3 bg-emerald-500 rounded mr-1"></span>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                                    <span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                                    <span className="inline-block w-3 h-3 bg-slate-500 rounded mr-1"></span>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                                    <span className="inline-block w-3 h-3 bg-amber-500 rounded mr-1"></span>
                                </th>
                                <th
                                    className="px-4 py-3 text-center text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-700/70"
                                    onClick={() => handleRegionSort('interest')}
                                >
                                    {t('interest_rate_col')} {regionSort === 'interest' && (regionSortDir === 'asc' ? '↑' : '↓')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {sortedRegions.map(region => (
                                <tr key={region.region} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-3 text-white font-medium">{region.region}</td>
                                    <td className="px-4 py-3 text-center text-slate-300">{region.total}</td>
                                    <td className="px-4 py-3 text-center text-slate-300">{region.called}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${region.coverage_percent >= 75 ? 'bg-emerald-500' : region.coverage_percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${region.coverage_percent}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm text-slate-400 w-10">{region.coverage_percent}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-emerald-400">{region.interested}</td>
                                    <td className="px-4 py-3 text-center text-red-400">{region.not_interested}</td>
                                    <td className="px-4 py-3 text-center text-slate-400">{region.no_answer}</td>
                                    <td className="px-4 py-3 text-center text-amber-400">{region.callback}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`font-semibold ${region.interest_rate >= 20 ? 'text-emerald-400' : region.interest_rate >= 10 ? 'text-amber-400' : 'text-slate-400'}`}>
                                            {region.interest_rate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Calls */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{t('recent_calls')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('time')}</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('caller')}</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('facility')}</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('region')}</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('outcome')}</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">{t('notes')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {data.recent_calls.map(call => (
                                <tr key={call.id} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-3 text-slate-400 text-sm">
                                        {format(new Date(call.called_at), 'MMM d, HH:mm')}
                                    </td>
                                    <td className="px-4 py-3 text-white">{call.caller_name}</td>
                                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={call.facility_name}>
                                        {call.facility_name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">{call.region}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getOutcomeColor(call.outcome)}`}>
                                            {call.outcome === 'INTERESTED' ? t('interested') :
                                                call.outcome === 'NOT_INTERESTED' ? t('not_interested') :
                                                    call.outcome === 'NO_ANSWER' ? t('no_answer') :
                                                        call.outcome === 'CALLBACK' ? t('callback') :
                                                            call.outcome === 'FOLLOW_UP' ? t('follow_up') : call.outcome}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-sm max-w-xs truncate" title={call.notes || ''}>
                                        {call.notes || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
