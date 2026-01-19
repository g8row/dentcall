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
            title: 'Cancel Campaign',
            message: `Are you sure you want to cancel "${campaign.name}"? The campaign will be archived but assignments will be preserved.`,
            isDestructive: false,
            confirmText: 'Cancel Campaign',
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
            title: 'Permanently Delete Campaign',
            message: `Are you sure you want to PERMANENTLY delete "${campaign.name}"? This will delete all ${campaign.total_assignments} assignments. This action cannot be undone!`,
            isDestructive: true,
            confirmText: 'Delete Forever',
            onConfirm: () => executePermanentDelete(campaign),
        });
    };

    const tabs: { key: TabType; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'ACTIVE', label: 'Active' },
        { key: 'COMPLETED', label: 'Completed' },
        { key: 'CANCELLED', label: 'Cancelled' },
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
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingCampaign(null)}
                                                    className="text-slate-400 hover:text-white text-sm"
                                                >
                                                    Cancel
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
                                                campaign.status === 'CANCELLED' ? 'Cancelled' : t('active')}
                                        </span>
                                        {campaign.status === 'ACTIVE' && (
                                            <>
                                                <button
                                                    onClick={() => handleMarkComplete(campaign)}
                                                    className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded hover:bg-emerald-500/30"
                                                >
                                                    ✓ Complete
                                                </button>
                                                <button
                                                    onClick={() => handleCancelCampaign(campaign)}
                                                    className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                        {campaign.status === 'CANCELLED' && (
                                            <button
                                                onClick={() => handlePermanentDelete(campaign)}
                                                className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30"
                                                title="Permanently delete campaign and assignments"
                                            >
                                                🗑️ Delete
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
                                            <span className="text-slate-400">Interest Rate</span>
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

            {/* Modal */}
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

