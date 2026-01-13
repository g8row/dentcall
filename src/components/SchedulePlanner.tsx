'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useTranslation } from '@/lib/translations';

interface RegionStats {
    region: string;
    total_dentists: number;
    called_dentists: number;
    coverage_percent: number;
    interested: number;
    not_interested: number;
    no_answer: number;
    callbacks_pending: number;
    interest_rate: number;
    last_called: string | null;
    days_since_last: number | null;
    priority_score: number;
    available_dentists: number;
}

interface Caller {
    id: string;
    username: string;
    daily_target: number;
}

interface SchedulePlannerProps {
    onClose: () => void;
    onScheduleGenerated: () => void;
}

type SortKey = 'region' | 'coverage_percent' | 'priority_score' | 'available_dentists' | 'interest_rate' | 'days_since_last';

export default function SchedulePlanner({ onClose, onScheduleGenerated }: SchedulePlannerProps) {
    const [regions, setRegions] = useState<RegionStats[]>([]);
    const [callers, setCallers] = useState<Caller[]>([]);
    const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
    const [summary, setSummary] = useState({ total_dentists: 0, total_available: 0, total_callbacks: 0 });
    const [totalDailyCapacity, setTotalDailyCapacity] = useState(0);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();

    // Schedule options
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [availableCities, setAvailableCities] = useState<{ name: string; count: number; available: number }[]>([]);
    const [citySearch, setCitySearch] = useState('');
    const [scheduleDays, setScheduleDays] = useState(7);
    const [scheduleStartDate, setScheduleStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [excludeDays, setExcludeDays] = useState(7);
    const [appendMode, setAppendMode] = useState(false);

    // UI state
    const [sortBy, setSortBy] = useState<SortKey>('priority_score');
    const [sortDesc, setSortDesc] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showCityFilter, setShowCityFilter] = useState(false);
    const [splitHeight, setSplitHeight] = useState(300);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = splitHeight;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientY - startY;
            setSplitHeight(Math.max(150, startHeight + delta));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'row-resize';
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/stats/schedule-planner?exclude_days=${excludeDays}`);
        const data = await res.json();

        setRegions(data.regions || []);
        setCallers(data.callers || []);
        setSuggestions(data.suggestions || {});
        setSummary(data.summary || { total_dentists: 0, total_available: 0, total_callbacks: 0 });
        setTotalDailyCapacity(data.totalDailyCapacity || 0);
        setLoading(false);
    }, [excludeDays]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Load cities when regions change
    useEffect(() => {
        const loadCities = async () => {
            if (selectedRegions.length === 0) {
                setAvailableCities([]);
                setSelectedCities([]);
                return;
            }

            const allCities: { name: string; count: number; available: number }[] = [];
            for (const region of selectedRegions) {
                const res = await fetch(`/api/dentists/locations?region=${encodeURIComponent(region)}`);
                const data = await res.json();
                if (data.cities) {
                    allCities.push(...data.cities);
                }
            }
            // Dedup by name
            const unique = Array.from(new Map(allCities.map(c => [c.name, c])).values());
            setAvailableCities(unique.sort((a, b) => a.name.localeCompare(b.name)));
        };

        loadCities();
    }, [selectedRegions]);

    const handleSort = (key: SortKey) => {
        if (sortBy === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(key);
            setSortDesc(true);
        }
    };

    const sortedRegions = [...regions]
        .filter(r => r.region.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const aVal = a[sortBy] ?? 0;
            const bVal = b[sortBy] ?? 0;
            if (typeof aVal === 'string') {
                return sortDesc ? bVal.toString().localeCompare(aVal) : aVal.localeCompare(bVal.toString());
            }
            return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
        });

    const selectedAvailable = selectedCities.length > 0
        ? selectedCities.reduce((sum, cityName) => {
            const city = availableCities.find(c => c.name === cityName);
            return sum + (city?.available || 0);
        }, 0)
        : regions
            .filter(r => selectedRegions.includes(r.region))
            .reduce((sum, r) => sum + r.available_dentists, 0);

    const daysNeeded = totalDailyCapacity > 0 ? Math.ceil(selectedAvailable / totalDailyCapacity) : 0;

    const handleGenerate = async () => {
        setGenerating(true);
        setResult(null);

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
            setResult({ success: true, message: data.message });
            onScheduleGenerated();
        } else {
            setResult({ success: false, message: data.error || 'Failed to generate schedule' });
        }

        setGenerating(false);
    };

    const applySuggestion = (type: string) => {
        const suggested = suggestions[type] || [];
        setSelectedRegions(prev => [...new Set([...prev, ...suggested])]);
    };

    const getCoverageColor = (percent: number) => {
        if (percent >= 75) return 'text-emerald-400';
        if (percent >= 25) return 'text-amber-400';
        return 'text-red-400';
    };

    const getCoverageBg = (percent: number) => {
        if (percent >= 75) return 'bg-emerald-500';
        if (percent >= 25) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const [mobileTab, setMobileTab] = useState<'selection' | 'settings'>('selection');

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-slate-800 rounded-xl p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
                    <p className="text-slate-400 mt-4">{t('loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm lg:bg-black/50 flex items-center justify-center z-50 p-0 lg:p-4 overflow-hidden">
            <div className="bg-slate-800 lg:rounded-xl w-full max-w-6xl border-none lg:border border-slate-700 h-full lg:h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 lg:p-6 border-b border-slate-700 flex-shrink-0 flex items-center justify-between bg-slate-800 z-10">
                    <div>
                        <h2 className="text-lg lg:text-xl font-bold">{t('schedule_planner')}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {summary.total_available.toLocaleString()} dentists • {summary.total_callbacks} callbacks
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-white text-2xl leading-none">×</button>
                </div>

                {/* Mobile Tabs */}
                <div className="flex border-b border-slate-700 lg:hidden">
                    <button
                        onClick={() => setMobileTab('selection')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mobileTab === 'selection'
                            ? 'border-emerald-500 text-white bg-slate-700/50'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        1. Select Regions ({selectedRegions.length})
                    </button>
                    <button
                        onClick={() => setMobileTab('settings')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mobileTab === 'settings'
                            ? 'border-emerald-500 text-white bg-slate-700/50'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        2. Settings & Generate
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
                    {/* Left Panel - Region Selection */}
                    <div className={`flex-1 p-4 flex flex-col overflow-hidden lg:border-r border-slate-700 lg:flex ${mobileTab === 'selection' ? 'flex' : 'hidden'
                        }`}>
                        {/* Smart Suggestions */}
                        <div className="mb-4 flex-shrink-0">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Suggestions</h3>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.hot_picks?.length > 0 && (
                                    <button
                                        onClick={() => applySuggestion('hot_picks')}
                                        className="px-3 py-1.5 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/30"
                                    >
                                        🔥 Hot ({suggestions.hot_picks.length})
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedRegions(suggestions.highest_priority || [])}
                                    className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30"
                                >
                                    ⭐ Top 5
                                </button>
                                {suggestions.callbacks_pending?.length > 0 && (
                                    <button
                                        onClick={() => applySuggestion('callbacks_pending')}
                                        className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/30"
                                    >
                                        📞 Callbacks ({suggestions.callbacks_pending.length})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search & Sort */}
                        <div className="flex gap-2 mb-3 flex-shrink-0">
                            <input
                                type="text"
                                placeholder={t('search')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
                            />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortKey)}
                                className="w-24 lg:w-32 px-2 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs lg:text-sm outline-none"
                            >
                                <option value="priority_score">Priority</option>
                                <option value="available_dentists">Count</option>
                                <option value="coverage_percent">Coverage</option>
                            </select>
                        </div>

                        {/* Select All / Clear */}
                        <div className="flex justify-between items-center mb-2 flex-shrink-0">
                            <span className="text-xs text-slate-400">
                                Showing {sortedRegions.length} regions
                            </span>
                            <div className="flex gap-3 text-xs">
                                <button
                                    onClick={() => setSelectedRegions(regions.filter(r => r.available_dentists > 0).map(r => r.region))}
                                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                                >
                                    {t('select_all')}
                                </button>
                                <button
                                    onClick={() => setSelectedRegions([])}
                                    className="text-slate-400 hover:text-white"
                                >
                                    {t('clear')}
                                </button>
                            </div>
                        </div>

                        {/* Region Table */}
                        <div
                            className={`space-y-2 overflow-y-auto border border-slate-700/50 rounded-lg p-2 ${showCityFilter ? 'shrink-0' : 'flex-1'}`}
                            style={showCityFilter && typeof window !== 'undefined' && window.innerWidth >= 1024 ? { height: `${splitHeight}px` } : {}}
                        >
                            {sortedRegions.map((region) => (
                                <div
                                    key={region.region}
                                    onClick={() => {
                                        setSelectedRegions(prev =>
                                            prev.includes(region.region)
                                                ? prev.filter(r => r !== region.region)
                                                : [...prev, region.region]
                                        );
                                    }}
                                    className={`p-3 rounded-lg cursor-pointer transition-all active:scale-[0.99] ${selectedRegions.includes(region.region)
                                        ? 'bg-emerald-500/10 border border-emerald-500/50'
                                        : 'bg-slate-900/40 border border-slate-700/50 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedRegions.includes(region.region)
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-slate-500'
                                                }`}>
                                                {selectedRegions.includes(region.region) && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white text-sm">{region.region}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    <span className={region.available_dentists > 0 ? 'text-white' : 'text-slate-500'}>
                                                        {region.available_dentists}
                                                    </span>
                                                    <span className="opacity-50"> / {region.total_dentists} available</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${region.available_dentists > 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {region.coverage_percent}% Done
                                                </span>
                                                {region.priority_score > 5 && (
                                                    <span className="text-[10px] text-amber-400 font-medium tracking-wide uppercase">High Priority</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* City Filter Section */}
                        {selectedRegions.length > 0 && availableCities.length > 0 && (
                            <div className={`mt-2 ${showCityFilter ? 'flex-1 flex flex-col min-h-0' : 'shrink-0'}`}>
                                <div className="flex items-center justify-between mb-2 shrink-0 py-2 border-t border-slate-700/50 lg:border-none">
                                    <h3 className="text-sm font-medium text-slate-300">
                                        Filter Cities ({selectedCities.length || 'All'})
                                    </h3>
                                    <button
                                        onClick={() => setShowCityFilter(!showCityFilter)}
                                        className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 bg-cyan-950/30 rounded"
                                    >
                                        {showCityFilter ? 'Hide Lists' : 'Filter by City'}
                                    </button>
                                </div>

                                {showCityFilter && (
                                    <div className="flex-1 flex flex-col min-h-0 space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Search cities..."
                                            value={citySearch}
                                            onChange={(e) => setCitySearch(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm shrink-0"
                                        />

                                        <div className="flex-1 overflow-y-auto space-y-1 border border-slate-700/50 rounded-lg p-2 bg-slate-900/20">
                                            {availableCities
                                                .filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
                                                .map(city => (
                                                    <label
                                                        key={city.name}
                                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${selectedCities.includes(city.name)
                                                            ? 'bg-cyan-500/10 border border-cyan-500/30'
                                                            : 'hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCities.includes(city.name)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedCities([...selectedCities, city.name]);
                                                                } else {
                                                                    setSelectedCities(selectedCities.filter(c => c !== city.name));
                                                                }
                                                            }}
                                                            className="rounded border-slate-600 bg-slate-800"
                                                        />
                                                        <div className="flex-1 flex justify-between text-sm">
                                                            <span className="text-slate-200">{city.name}</span>
                                                            <span className="text-xs text-slate-500 tabular-nums">
                                                                {city.available}
                                                            </span>
                                                        </div>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mobile FAB to go to Next Step */}
                        {selectedRegions.length > 0 && (
                            <button
                                onClick={() => setMobileTab('settings')}
                                className="lg:hidden mt-4 w-full py-3 bg-emerald-500 text-white font-bold rounded-lg shadow-lg"
                            >
                                Next: Configure Schedule ({selectedAvailable})
                            </button>
                        )}
                    </div>

                    {/* Right Panel - Settings & Generate */}
                    <div className={`w-full lg:w-96 bg-slate-800/50 lg:bg-transparent p-4 flex flex-col overflow-y-auto lg:border-l border-slate-700 lg:flex ${mobileTab === 'settings' ? 'flex' : 'hidden'
                        }`}>

                        <div className="lg:hidden mb-4">
                            <button
                                onClick={() => setMobileTab('selection')}
                                className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
                            >
                                ← Back to Selection
                            </button>
                        </div>

                        {/* Preview Card */}
                        <div className="bg-slate-900/80 rounded-xl p-5 mb-6 border border-slate-700/50 shadow-sm">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{t('preview')}</h3>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Selected Scope</span>
                                    <div className="text-right">
                                        <span className="block text-white font-medium">{selectedRegions.length} Regions</span>
                                        {selectedCities.length > 0 && <span className="text-xs text-slate-500">({selectedCities.length} Cities)</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Dentists to call</span>
                                    <span className="text-white font-bold text-lg">{selectedAvailable.toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-slate-700/50 my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Team Capacity (Daily)</span>
                                    <span className="text-white font-medium">{totalDailyCapacity} calls</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-slate-400">Est. Time Needed</span>
                                    <span className={`font-bold ${daysNeeded <= scheduleDays ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {daysNeeded} days
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Options Form */}
                        <div className="space-y-5 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('start_date')}</label>
                                <input
                                    type="date"
                                    value={scheduleStartDate}
                                    onChange={(e) => setScheduleStartDate(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-medium text-slate-400">Schedule Duration</label>
                                    <span className="text-xs font-bold text-emerald-400">{scheduleDays} Days</span>
                                </div>
                                <input
                                    type="range"
                                    value={scheduleDays}
                                    onChange={(e) => setScheduleDays(parseInt(e.target.value))}
                                    min={1}
                                    max={14}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                    <span>1 Day</span>
                                    <span>2 Weeks</span>
                                </div>
                            </div>

                            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-medium text-slate-400">Exclude Recently Called</label>
                                    <span className="text-xs font-bold text-white">{excludeDays} Days</span>
                                </div>
                                <input
                                    type="range"
                                    value={excludeDays}
                                    onChange={(e) => setExcludeDays(parseInt(e.target.value))}
                                    min={0}
                                    max={30}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"
                                />
                            </div>

                            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition cursor-pointer border border-transparent hover:border-slate-700">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={appendMode}
                                        onChange={(e) => setAppendMode(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                    />
                                </div>
                                <div>
                                    <span className="block text-sm font-medium text-white">{t('append_mode')}</span>
                                    <span className="block text-xs text-slate-500">Keep existing assignments, only add new</span>
                                </div>
                            </label>
                        </div>

                        {/* Result Message */}
                        {result && (
                            <div className={`p-4 rounded-xl mb-4 text-sm font-medium ${result.success
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : 'bg-red-500/10 border border-red-500/30 text-red-400'
                                }`}>
                                {result.message}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-auto space-y-3">
                            <button
                                onClick={handleGenerate}
                                disabled={generating || selectedRegions.length === 0}
                                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {generating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀 Generate Schedule</span>
                                        {selectedAvailable > 0 && <span className="bg-emerald-600 px-2 py-0.5 rounded text-xs">({selectedAvailable})</span>}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-3 text-slate-400 hover:text-white font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
