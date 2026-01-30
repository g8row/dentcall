'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ConfirmModal from '@/components/ConfirmModal';

interface Campaign {
    id: string;
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    regions: string;
    cities: string | null;
    callers: string;
    status: string;
    total_assignments: number;
    completed_assignments: number;
    outcomes: Record<string, number>;
    created_at: string;
    completed_at: string | null;
    cancelled_at: string | null;
}

type TabType = 'all' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export default function CampaignsPage() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const { t } = useTranslation();

    // Full Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState<{
        id: string;
        name: string;
        description: string;
        start_date: string;
        end_date: string;
        originalStartDate: string;
        originalEndDate: string;
        selectedRegions: string[];
        selectedCities: string[];
    }>({
        id: '',
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        originalStartDate: '',
        originalEndDate: '',
        selectedRegions: [],
        selectedCities: [],
    });

    // Regions/Cities selection state
    const [availableRegions, setAvailableRegions] = useState<string[]>([]);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [showRegionPicker, setShowRegionPicker] = useState(false);
    const [showCityPicker, setShowCityPicker] = useState(false);
    const [rescheduleAssignments, setRescheduleAssignments] = useState(true);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isDestructive: boolean;
        confirmText: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        isDestructive: false,
        confirmText: 'Confirm',
        onConfirm: () => { },
    });

    const loadCampaigns = useCallback(async () => {
        const url = activeTab === 'all'
            ? '/api/campaigns'
            : `/api/campaigns?status=${activeTab}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            router.push('/');
            return;
        }
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setLoading(false);
    }, [router, activeTab]);

    useEffect(() => {
        loadCampaigns();

        const interval = setInterval(loadCampaigns, 10000);
        return () => clearInterval(interval);
    }, [loadCampaigns]);

    // Fetch available regions
    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const res = await fetch('/api/dentists/locations');
                const data = await res.json();
                if (data.regions) {
                    setAvailableRegions(data.regions.map((r: { region: string }) => r.region));
                }
            } catch (err) {
                console.error('Failed to fetch regions', err);
            }
        };
        fetchRegions();
    }, []);

    // Fetch cities when selected regions change
    useEffect(() => {
        const fetchCities = async () => {
            if (editFormData.selectedRegions.length === 0) {
                setAvailableCities([]);
                return;
            }

            try {
                const allCities: string[] = [];
                for (const region of editFormData.selectedRegions) {
                    const res = await fetch(`/api/dentists/locations?region=${encodeURIComponent(region)}`);
                    const data = await res.json();
                    if (data.cities) {
                        allCities.push(...data.cities);
                    }
                }
                setAvailableCities([...new Set(allCities)].sort());
            } catch (err) {
                console.error('Failed to fetch cities', err);
            }
        };
        fetchCities();
    }, [editFormData.selectedRegions]);

    const executeCancelCampaign = async (campaign: Campaign) => {
        try {
            const res = await fetch(`/api/campaigns?id=${campaign.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                loadCampaigns();
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to cancel campaign'}`);
            }
        } catch (err) {
            alert('Failed to cancel campaign');
            console.error(err);
        }
    };

    const handleCancelCampaign = (campaign: Campaign) => {
        setModalConfig({
            isOpen: true,
            title: t('cancel_campaign_title'),
            message: t('cancel_campaign_msg'),
            isDestructive: false,
            confirmText: t('cancel_campaign_confirm'),
            onConfirm: () => executeCancelCampaign(campaign),
        });
    };

    const handleMarkComplete = async (campaign: Campaign) => {
        try {
            const res = await fetch('/api/campaigns', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: campaign.id, status: 'COMPLETED' }),
            });

            if (res.ok) {
                loadCampaigns();
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to update campaign'}`);
            }
        } catch (err) {
            alert('Failed to update campaign');
            console.error(err);
        }
    };

    const handleSaveName = async (campaignId: string) => {
        try {
            const res = await fetch('/api/campaigns', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: campaignId, name: editName }),
            });

            if (res.ok) {
                setEditingCampaign(null);
                loadCampaigns();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const openFullEditModal = (campaign: Campaign) => {
        const regionsList = campaign.regions === 'All Regions' ? [] : campaign.regions.split(', ').filter(r => r);
        const citiesList = campaign.cities ? campaign.cities.split(', ').filter(c => c) : [];

        setEditFormData({
            id: campaign.id,
            name: campaign.name,
            description: campaign.description || '',
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            originalStartDate: campaign.start_date,
            originalEndDate: campaign.end_date,
            selectedRegions: regionsList,
            selectedCities: citiesList,
        });
        setRescheduleAssignments(true);
        setShowEditModal(true);
    };

    const datesChanged = editFormData.start_date !== editFormData.originalStartDate ||
        editFormData.end_date !== editFormData.originalEndDate;

    const handleSaveFullEdit = async () => {
        try {
            const res = await fetch('/api/campaigns', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editFormData.id,
                    name: editFormData.name,
                    description: editFormData.description || null,
                    start_date: editFormData.start_date,
                    end_date: editFormData.end_date,
                    target_regions: editFormData.selectedRegions.length > 0 ? editFormData.selectedRegions : null,
                    target_cities: editFormData.selectedCities.length > 0 ? editFormData.selectedCities : null,
                    reschedule: datesChanged && rescheduleAssignments,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setShowEditModal(false);
                loadCampaigns();
                if (data.rescheduled > 0) {
                    alert(`Campaign updated. ${data.rescheduled} assignments rescheduled.`);
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving campaign');
        }
    };

    const toggleRegion = (region: string) => {
        setEditFormData(prev => ({
            ...prev,
            selectedRegions: prev.selectedRegions.includes(region)
                ? prev.selectedRegions.filter(r => r !== region)
                : [...prev.selectedRegions, region],
            selectedCities: [], // Reset cities when regions change
        }));
    };

    const toggleCity = (city: string) => {
        setEditFormData(prev => ({
            ...prev,
            selectedCities: prev.selectedCities.includes(city)
                ? prev.selectedCities.filter(c => c !== city)
                : [...prev.selectedCities, city],
        }));
    };

    const executePermanentDelete = async (campaign: Campaign) => {
        try {
            const res = await fetch(`/api/campaigns?id=${campaign.id}&force=true`, {
                method: 'DELETE',
            });

            if (res.ok) {
                loadCampaigns();
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to delete campaign'}`);
            }
        } catch (err) {
            alert('Failed to delete campaign');
            console.error(err);
        }
    };

    const handlePermanentDelete = (campaign: Campaign) => {
        setModalConfig({
            isOpen: true,
            title: t('delete_campaign_title'),
            message: `${t('delete_campaign_msg')} ("${campaign.name}")`,
            isDestructive: true,
            confirmText: t('delete_forever'),
            onConfirm: () => executePermanentDelete(campaign),
        });
    };

    const tabs: { key: TabType; label: string }[] = [
        { key: 'all', label: t('tab_all') },
        { key: 'ACTIVE', label: t('tab_active') },
        { key: 'COMPLETED', label: t('tab_completed') },
        { key: 'CANCELLED', label: t('tab_cancelled') },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-white">
                            ← {t('back')}
                        </button>
                        <h1 className="text-xl font-bold">{t('campaign_summary')}</h1>
                    </div>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Tabs */}
            <div className="max-w-4xl mx-auto px-4 pt-4">
                <div className="flex gap-2 border-b border-slate-700 pb-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${activeTab === tab.key
                                ? 'bg-slate-800 text-white border-b-2 border-emerald-500'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                {campaigns.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📊</div>
                        <h2 className="text-xl font-semibold mb-2">{t('no_campaigns')}</h2>
                        <p className="text-slate-400">{t('generate_hint')}</p>
                    </div>
                ) : (
                    campaigns.map((campaign) => {
                        const progress = campaign.total_assignments > 0
                            ? Math.round((campaign.completed_assignments / campaign.total_assignments) * 100)
                            : 0;

                        const interested = campaign.outcomes?.INTERESTED || 0;
                        const notInterested = campaign.outcomes?.NOT_INTERESTED || 0;
                        const noAnswer = campaign.outcomes?.NO_ANSWER || 0;
                        const callback = campaign.outcomes?.CALLBACK || 0;
                        const orderTaken = campaign.outcomes?.ORDER_TAKEN || 0;
                        const totalCalls = interested + notInterested + noAnswer + callback + orderTaken;

                        return (
                            <div key={campaign.id} className={`bg-slate-800 rounded-xl border p-6 ${campaign.status === 'CANCELLED' ? 'border-red-500/30 opacity-75' :
                                campaign.status === 'COMPLETED' ? 'border-emerald-500/30' :
                                    'border-slate-700'
                                }`}>
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        {editingCampaign === campaign.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName(campaign.id)}
                                                />
                                                <button
                                                    onClick={() => handleSaveName(campaign.id)}
                                                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                                                >
                                                    {t('save')}
                                                </button>
                                                <button
                                                    onClick={() => setEditingCampaign(null)}
                                                    className="text-slate-400 hover:text-white text-sm"
                                                >
                                                    {t('cancel')}
                                                </button>
                                            </div>
                                        ) : (
                                            <h3
                                                className="text-lg font-semibold cursor-pointer hover:text-emerald-400"
                                                onClick={() => {
                                                    setEditingCampaign(campaign.id);
                                                    setEditName(campaign.name);
                                                }}
                                                title="Click to edit name"
                                            >
                                                {campaign.name}
                                            </h3>
                                        )}
                                        <p className="text-sm text-slate-400">{campaign.regions}</p>
                                        {campaign.cities && (
                                            <p className="text-xs text-slate-500">Cities: {campaign.cities}</p>
                                        )}
                                        <p className="text-xs text-slate-500">Callers: {campaign.callers}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${campaign.status === 'COMPLETED'
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : campaign.status === 'CANCELLED'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                            {campaign.status === 'COMPLETED' ? t('completed') :
                                                campaign.status === 'CANCELLED' ? t('status_cancelled') : t('active')}
                                        </span>
                                        {campaign.status === 'ACTIVE' && (
                                            <>
                                                <button
                                                    onClick={() => openFullEditModal(campaign)}
                                                    className="px-3 py-1 text-xs bg-slate-600/50 text-slate-300 border border-slate-500/50 rounded hover:bg-slate-600"
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    onClick={() => handleMarkComplete(campaign)}
                                                    className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded hover:bg-emerald-500/30"
                                                >
                                                    {t('mark_complete')}
                                                </button>
                                                <button
                                                    onClick={() => handleCancelCampaign(campaign)}
                                                    className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30"
                                                >
                                                    {t('cancel')}
                                                </button>
                                            </>
                                        )}
                                        {campaign.status === 'CANCELLED' && (
                                            <button
                                                onClick={() => handlePermanentDelete(campaign)}
                                                className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30"
                                                title="Permanently delete campaign and assignments"
                                            >
                                                🗑️ {t('delete')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">{t('progress')}</span>
                                        <span className="text-white">{campaign.completed_assignments} / {campaign.total_assignments} ({progress}%)</span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                                        <div style={{ width: `${(interested / campaign.total_assignments) * 100}%` }} className="h-full bg-emerald-500" title="Interested" />
                                        <div style={{ width: `${(notInterested / campaign.total_assignments) * 100}%` }} className="h-full bg-red-500" title="Not Interested" />
                                        <div style={{ width: `${(callback / campaign.total_assignments) * 100}%` }} className="h-full bg-amber-500" title="Callback" />
                                        <div style={{ width: `${(orderTaken / campaign.total_assignments) * 100}%` }} className="h-full bg-cyan-500" title="Order Taken" />
                                        <div style={{ width: `${(noAnswer / campaign.total_assignments) * 100}%` }} className="h-full bg-slate-500" title="No Answer" />
                                    </div>
                                </div>

                                {/* Outcome Stats */}
                                {totalCalls > 0 && (
                                    <div className="grid grid-cols-5 gap-4 pt-4 border-t border-slate-700">
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-emerald-400">{interested}</div>
                                            <div className="text-xs text-slate-400">✅ {t('interested')}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-red-400">{notInterested}</div>
                                            <div className="text-xs text-slate-400">❌ {t('not_interested')}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-slate-400">{noAnswer}</div>
                                            <div className="text-xs text-slate-400">📵 {t('no_answer')}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-amber-400">{callback}</div>
                                            <div className="text-xs text-slate-400">📞 {t('callback')}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-cyan-400">{orderTaken}</div>
                                            <div className="text-xs text-slate-400">📦 {t('order_taken')}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Interest Rate */}
                                {totalCalls > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">{t('interest_rate_col')}</span>
                                            <span className={`font-medium ${interested > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </main>

            {/* Full Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Edit Campaign</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white min-h-[80px]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={editFormData.start_date}
                                        onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={editFormData.end_date}
                                        onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                            </div>

                            {/* Regions Picker */}
                            <div className="relative">
                                <label className="block text-sm text-slate-400 mb-1">Regions</label>
                                <button
                                    type="button"
                                    onClick={() => setShowRegionPicker(!showRegionPicker)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-left flex justify-between items-center"
                                >
                                    <span className={editFormData.selectedRegions.length > 0 ? 'text-white' : 'text-slate-500'}>
                                        {editFormData.selectedRegions.length > 0
                                            ? editFormData.selectedRegions.join(', ')
                                            : 'All Regions (click to select)'}
                                    </span>
                                    <span className="text-slate-400">▼</span>
                                </button>
                                {showRegionPicker && (
                                    <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg max-h-48 overflow-y-auto shadow-xl">
                                        {availableRegions.map(region => (
                                            <label
                                                key={region}
                                                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editFormData.selectedRegions.includes(region)}
                                                    onChange={() => toggleRegion(region)}
                                                    className="rounded border-slate-600 bg-slate-800 text-emerald-500"
                                                />
                                                <span className="text-white">{region}</span>
                                            </label>
                                        ))}
                                        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowRegionPicker(false)}
                                                className="w-full text-center text-sm text-emerald-400 hover:text-emerald-300"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Cities Picker */}
                            <div className="relative">
                                <label className="block text-sm text-slate-400 mb-1">Cities (optional)</label>
                                <button
                                    type="button"
                                    onClick={() => editFormData.selectedRegions.length > 0 && setShowCityPicker(!showCityPicker)}
                                    className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-left flex justify-between items-center ${editFormData.selectedRegions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    disabled={editFormData.selectedRegions.length === 0}
                                >
                                    <span className={editFormData.selectedCities.length > 0 ? 'text-white' : 'text-slate-500'}>
                                        {editFormData.selectedCities.length > 0
                                            ? editFormData.selectedCities.join(', ')
                                            : 'All Cities (click to select)'}
                                    </span>
                                    <span className="text-slate-400">▼</span>
                                </button>
                                {showCityPicker && availableCities.length > 0 && (
                                    <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg max-h-48 overflow-y-auto shadow-xl">
                                        {availableCities.map(city => (
                                            <label
                                                key={city}
                                                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editFormData.selectedCities.includes(city)}
                                                    onChange={() => toggleCity(city)}
                                                    className="rounded border-slate-600 bg-slate-800 text-emerald-500"
                                                />
                                                <span className="text-white">{city}</span>
                                            </label>
                                        ))}
                                        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowCityPicker(false)}
                                                className="w-full text-center text-sm text-emerald-400 hover:text-emerald-300"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reschedule Warning */}
                        {datesChanged && (
                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <span className="text-amber-400">⚠️</span>
                                    <div>
                                        <p className="text-amber-300 text-sm font-medium">Date Range Changed</p>
                                        <p className="text-amber-200/70 text-xs mt-1">
                                            Changing dates will delete existing assignments and redistribute them across the new date range.
                                        </p>
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={rescheduleAssignments}
                                                onChange={(e) => setRescheduleAssignments(e.target.checked)}
                                                className="rounded border-amber-500 bg-slate-800 text-amber-500"
                                            />
                                            <span className="text-amber-200 text-sm">Reschedule assignments to new dates</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setShowRegionPicker(false);
                                    setShowCityPicker(false);
                                }}
                                className="px-4 py-2 text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFullEdit}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                isDestructive={modalConfig.isDestructive}
                confirmText={modalConfig.confirmText}
                onConfirm={modalConfig.onConfirm}
                onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}

