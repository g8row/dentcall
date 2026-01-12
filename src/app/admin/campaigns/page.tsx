'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface Campaign {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    regions: string;
    status: string;
    total_assignments: number;
    completed_assignments: number;
    outcomes: Record<string, number>;
    created_at: string;
}

export default function CampaignsPage() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();

    const loadCampaigns = useCallback(async () => {
        const res = await fetch('/api/campaigns', { cache: 'no-store' });
        if (!res.ok) {
            router.push('/');
            return;
        }
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setLoading(false);
    }, [router]);

    useEffect(() => {
        loadCampaigns();

        const interval = setInterval(loadCampaigns, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [loadCampaigns]);

    const handleCancelCampaign = async (campaign: Campaign) => {
        if (!confirm(`Cancel campaign "${campaign.name}"? This will delete all assignments.`)) return;

        try {
            const res = await fetch(`/api/campaigns?start_date=${campaign.start_date}&end_date=${campaign.end_date}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (res.ok) {
                alert(`Deleted ${data.deleted} assignments`);
                loadCampaigns();
            } else {
                alert(`Error: ${data.error || 'Failed to cancel campaign'}`);
            }
        } catch (err) {
            alert('Failed to cancel campaign');
            console.error(err);
        }
    };

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
                        const totalCalls = interested + notInterested + noAnswer + callback + (campaign.outcomes?.FOLLOW_UP || 0);

                        return (
                            <div key={campaign.id} className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">{campaign.name}</h3>
                                        <p className="text-sm text-slate-400">{campaign.regions}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${campaign.status === 'COMPLETED'
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                            {campaign.status === 'COMPLETED' ? t('completed') : t('active')}
                                        </span>
                                        {campaign.status === 'ACTIVE' && (
                                            <button
                                                onClick={() => handleCancelCampaign(campaign)}
                                                className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30"
                                            >
                                                Cancel
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
                                        <div style={{ width: `${(callback / campaign.total_assignments) * 100}%` }} className="h-full bg-amber-500" title="Callback/Follow-up" />
                                        <div style={{ width: `${(noAnswer / campaign.total_assignments) * 100}%` }} className="h-full bg-slate-500" title="No Answer" />
                                    </div>
                                </div>

                                {/* Outcome Stats */}
                                {totalCalls > 0 && (
                                    <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-700">
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
        </div>
    );
}
