
import React from 'react';
import { useTranslation } from '@/lib/translations';

interface SchedulingInfoModalProps {
    onClose: () => void;
}

export default function SchedulingInfoModal({ onClose }: SchedulingInfoModalProps) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl sticky top-0">
                    <h2 className="text-xl font-bold text-white">{t('sl_title')}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto text-slate-300 space-y-6">
                    <p className="text-sm text-slate-400 italic">
                        {t('sl_intro')}
                    </p>

                    <section>
                        <h3 className="text-lg font-semibold text-emerald-400 mb-2">{t('sl_selection_title')}</h3>
                        <p className="text-sm mb-2">{t('sl_selection_desc')}</p>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400">
                            <li>{t('sl_selection_crit1')}</li>
                            <li>{t('sl_selection_crit2')}</li>
                        </ul>
                        <div className="mt-2 text-xs text-slate-500 bg-slate-900/30 p-2 rounded">
                            {t('sl_selection_ex')}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-emerald-400 mb-2">{t('sl_prioritization_title')}</h3>
                        <p className="text-sm mb-2">{t('sl_prioritization_desc')}</p>
                        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-400">
                            <li className="text-amber-400 font-medium">{t('sl_prio_1')}</li>
                            <li>{t('sl_prio_2')}</li>
                            <li>{t('sl_prio_3')}</li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-emerald-400 mb-2">{t('sl_dist_title')}</h3>
                        <p className="text-sm mb-2">{t('sl_dist_desc')}</p>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-400">
                            <li>
                                <strong>{t('sl_dist_pref')}</strong>
                            </li>
                            <li>{t('sl_dist_common')}</li>
                        </ul>
                        <div className="mt-2 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 border border-slate-700/50">
                            💡 {t('sl_dist_note')}
                        </div>
                        <div className="mt-2 pl-4 border-l-2 border-slate-700">
                            <p className="text-xs text-slate-500 mb-1">{t('sl_dist_day_title')}</p>
                            <ul className="text-xs text-slate-400 space-y-1">
                                <li>{t('sl_dist_step1')}</li>
                                <li>{t('sl_dist_step2')}</li>
                                <li>{t('sl_dist_step3')}</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-emerald-400 mb-2">{t('sl_outcomes_title')}</h3>
                        <div className="overflow-hidden rounded-lg border border-slate-700">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-700/50 text-slate-300">
                                    <tr>
                                        <th className="p-3">{t('sl_table_outcome')}</th>
                                        <th className="p-3 hidden sm:table-cell">{t('sl_table_meaning')}</th>
                                        <th className="p-3">{t('sl_table_consequence')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    <tr className="bg-slate-800/50">
                                        <td className="p-3 text-emerald-400 font-bold">{t('sl_out_int')}</td>
                                        <td className="p-3 hidden sm:table-cell">{t('sl_mean_int')}</td>
                                        <td className="p-3">{t('sl_cons_int')}</td>
                                    </tr>
                                    <tr className="bg-slate-800/50">
                                        <td className="p-3 text-red-400 font-bold">{t('sl_out_not')}</td>
                                        <td className="p-3 hidden sm:table-cell">{t('sl_mean_not')}</td>
                                        <td className="p-3">{t('sl_cons_not')}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 text-slate-300">{t('sl_out_no')}</td>
                                        <td className="p-3 hidden sm:table-cell">{t('sl_mean_no')}</td>
                                        <td className="p-3">{t('sl_back_no')}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 text-amber-400">{t('sl_out_cb')}</td>
                                        <td className="p-3 hidden sm:table-cell">{t('sl_mean_cb')}</td>
                                        <td className="p-3">{t('sl_back_cb')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                        <h3 className="text-md font-bold text-slate-200 mb-2">{t('sl_exclude_title')}</h3>
                        <p className="text-xs text-slate-400 mb-2">{t('sl_exclude_desc')}</p>
                        <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
                            <li>{t('sl_exclude_ex1')}</li>
                            <li>{t('sl_exclude_ex2')}</li>
                            <li>{t('sl_exclude_ex3')}</li>
                        </ul>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
                    >
                        {t('finish')}
                    </button>
                </div>
            </div>
        </div>
    );
}
