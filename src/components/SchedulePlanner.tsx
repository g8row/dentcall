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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-800 rounded-xl w-full max-w-6xl border border-slate-700 my-8 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">{t('schedule_planner')}</h2>
                            <p className="text-sm text-slate-400 mt-1">
                                {summary.total_available.toLocaleString()} dentists available • {summary.total_callbacks} pending callbacks
                            </p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Left Panel - Region Selection */}
                    <div className="flex-1 p-4 overflow-y-auto border-r border-slate-700">
                        {/* Smart Suggestions */}
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-slate-300 mb-2">Smart Suggestions</h3>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.hot_picks?.length > 0 && (
                                    <button
                                        onClick={() => applySuggestion('hot_picks')}
                                        className="px-3 py-1.5 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/30"
                                    >
                                        🔥 Hot Picks ({suggestions.hot_picks.length})
                                    </button>
                                )}
                                {suggestions.quick_wins?.length > 0 && (
                                    <button
                                        onClick={() => applySuggestion('quick_wins')}
                                        className="px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/30"
                                    >
                                        ⚡ Quick Wins ({suggestions.quick_wins.length})
                                    </button>
                                )}
                                {suggestions.callbacks_pending?.length > 0 && (
                                    <button
                                        onClick={() => applySuggestion('callbacks_pending')}
                                        className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/30"
                                    >
                                        📞 Callbacks ({suggestions.callbacks_pending.length})
                                    </button>
                                )}
                                {suggestions.reengage?.length > 0 && (
                                    <button
                                        onClick={() => applySuggestion('reengage')}
                                        className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30"
                                    >
                                        🔄 Re-engage ({suggestions.reengage.length})
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedRegions(suggestions.highest_priority || [])}
                                    className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30"
                                >
                                    ⭐ Top 5 Priority
                                </button>
                            </div>
                        </div>

                        {/* Search & Sort */}
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder={t('search_cities')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                            />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortKey)}
                                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                            >
                                <option value="priority_score">Priority</option>
                                <option value="available_dentists">Available</option>
                                <option value="coverage_percent">Coverage</option>
                                <option value="interest_rate">Interest %</option>
                                <option value="days_since_last">Days Since</option>
                                <option value="region">Name</option>
                            </select>
                        </div>

                        {/* Select All / Clear */}
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setSelectedRegions(regions.filter(r => r.available_dentists > 0).map(r => r.region))}
                                className="text-xs text-emerald-400 hover:text-emerald-300"
                            >
                                {t('select_all')}
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                                onClick={() => setSelectedRegions([])}
                                className="text-xs text-slate-400 hover:text-white"
                            >
                                {t('clear')}
                            </button>
                        </div>

                        {/* Region Table */}
                        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
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
                                    className={`p-3 rounded-lg cursor-pointer transition-all ${selectedRegions.includes(region.region)
                                        ? 'bg-emerald-500/20 border border-emerald-500'
                                        : 'bg-slate-900/50 border border-slate-700 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedRegions.includes(region.region)}
                                                onChange={() => { }}
                                                className="rounded"
                                            />
                                            <div>
                                                <div className="font-medium text-white text-sm">{region.region}</div>
                                                <div className="text-xs text-slate-400">
                                                    {region.available_dentists} available of {region.total_dentists}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2">
                                                {/* Coverage bar */}
                                                <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${getCoverageBg(region.coverage_percent)}`}
                                                        style={{ width: `${region.coverage_percent}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-medium ${getCoverageColor(region.coverage_percent)}`}>
                                                    {region.coverage_percent}%
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {region.callbacks_pending > 0 && (
                                                    <span className="text-amber-400 mr-2">📞{region.callbacks_pending}</span>
                                                )}
                                                {region.interest_rate > 0 && (
                                                    <span className="text-emerald-400 mr-2">✅{region.interest_rate}%</span>
                                                )}
                                                {region.days_since_last !== null && (
                                                    <span>{region.days_since_last}d ago</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* City Filter Section */}
                        {selectedRegions.length > 0 && availableCities.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-slate-300">
                                        Filter by Cities ({selectedCities.length} / {availableCities.length})
                                    </h3>
                                    <button
                                        onClick={() => setShowCityFilter(!showCityFilter)}
                                        className="text-xs text-cyan-400 hover:text-cyan-300"
                                    >
                                        {showCityFilter ? 'Hide' : 'Show'} Cities
                                    </button>
                                </div>

                                {showCityFilter && (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Search cities..."
                                            value={citySearch}
                                            onChange={(e) => setCitySearch(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                                        />

                                        <div className="flex gap-2 text-xs">
                                            <button
                                                onClick={() => setSelectedCities(availableCities.map(c => c.name))}
                                                className="text-emerald-400 hover:text-emerald-300"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-slate-600">|</span>
                                            <button
                                                onClick={() => setSelectedCities([])}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {availableCities
                                                .filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
                                                .map(city => (
                                                    <label
                                                        key={city.name}
                                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedCities.includes(city.name)
                                                            ? 'bg-cyan-500/20 border border-cyan-500'
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
                                                            className="rounded"
                                                        />
                                                        <div className="flex-1 flex justify-between">
                                                            <span className="text-sm text-slate-300">{city.name}</span>
                                                            <span className="text-xs text-slate-500">
                                                                {city.available > 0 ? (
                                                                    <span className="text-emerald-400">{city.available} av.</span>
                                                                ) : (
                                                                    <span>0 av.</span>
                                                                )}
                                                                <span className="ml-1 opacity-50">/ {city.count}</span>
                                                            </span>
                                                        </div>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Preview & Options */}
                    <div className="w-full lg:w-80 p-4 flex flex-col">
                        {/* Preview */}
                        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                            <h3 className="text-sm font-medium text-slate-300 mb-3">{t('preview')}</h3>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">{t('select_regions')}</span>
                                    <span className="text-white font-medium">{selectedRegions.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Dentists to call</span>
                                    <span className="text-white font-medium">{selectedAvailable.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Daily capacity</span>
                                    <span className="text-white font-medium">{totalDailyCapacity}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-700 pt-2">
                                    <span className="text-slate-400">Est. days needed</span>
                                    <span className={`font-bold ${daysNeeded <= scheduleDays ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {daysNeeded} days
                                    </span>
                                </div>
                            </div>

                            {daysNeeded > scheduleDays && selectedAvailable > 0 && (
                                <div className="mt-3 p-2 bg-amber-500/20 rounded text-xs text-amber-400">
                                    ⚠️ {scheduleDays} days won't cover all {selectedAvailable} dentists.
                                    Consider increasing days or reducing regions.
                                </div>
                            )}
                        </div>

                        {/* Caller Workload */}
                        {callers.length > 0 && (
                            <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                                <h3 className="text-sm font-medium text-slate-300 mb-2">{t('call_load')}</h3>
                                <div className="space-y-2">
                                    {callers.map(c => {
                                        const callerShare = totalDailyCapacity > 0
                                            ? Math.round((c.daily_target / totalDailyCapacity) * selectedAvailable)
                                            : 0;
                                        return (
                                            <div key={c.id} className="flex justify-between text-sm">
                                                <span className="text-slate-400">{c.username}</span>
                                                <span className="text-white">{callerShare} calls</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Options */}
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">{t('start_date')}</label>
                                <input
                                    type="date"
                                    value={scheduleStartDate}
                                    onChange={(e) => setScheduleStartDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">{t('days_to_schedule')} ({scheduleDays})</label>
                                <input
                                    type="range"
                                    value={scheduleDays}
                                    onChange={(e) => setScheduleDays(parseInt(e.target.value))}
                                    min={1}
                                    max={14}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    {t('exclude_last_days')} ({excludeDays})
                                </label>
                                <input
                                    type="range"
                                    value={excludeDays}
                                    onChange={(e) => setExcludeDays(parseInt(e.target.value))}
                                    min={0}
                                    max={30}
                                    className="w-full"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={appendMode}
                                    onChange={(e) => setAppendMode(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-slate-300">{t('append_mode')}</span>
                            </label>
                        </div>

                        {/* Result */}
                        {result && (
                            <div className={`p-3 rounded-lg mb-4 ${result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                <p className="text-sm">{result.message}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-auto space-y-2">
                            <button
                                onClick={handleGenerate}
                                disabled={generating || selectedRegions.length === 0}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition"
                            >
                                {generating ? t('generating') : `${t('generate')} (${selectedAvailable})`}
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-2 text-slate-400 hover:text-white"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
