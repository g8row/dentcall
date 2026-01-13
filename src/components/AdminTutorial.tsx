'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/translations';

interface AdminTutorialProps {
    onClose: () => void;
}

export default function AdminTutorial({ onClose }: AdminTutorialProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: t('tutorial_title'),
            desc: t('tutorial_description'),
            icon: '👋',
            color: 'bg-indigo-500'
        },
        {
            title: t('tut_schedule_title'),
            desc: t('tut_schedule_desc'),
            icon: '📅',
            color: 'bg-blue-500'
        },
        {
            title: t('tut_stats_title'),
            desc: t('tut_stats_desc'),
            icon: '📊',
            color: 'bg-emerald-500'
        },
        {
            title: t('tut_calendar_title'),
            desc: t('tut_calendar_desc'),
            icon: '🗓️',
            color: 'bg-indigo-500'
        },
        {
            title: t('tut_users_title'),
            desc: t('tut_users_desc'),
            icon: '👥',
            color: 'bg-purple-500'
        },
        {
            title: t('tut_export_title'),
            desc: t('tut_export_desc'),
            icon: '📥',
            color: 'bg-orange-500'
        },
        {
            title: t('tut_campaigns_title'),
            desc: t('tut_campaigns_desc'),
            icon: '🎯',
            color: 'bg-red-500'
        }
    ];

    const currentStep = steps[step];
    const isLast = step === steps.length - 1;

    const handleNext = () => {
        if (isLast) {
            onClose();
        } else {
            setStep(step + 1);
        }
    };

    const handlePrev = () => {
        if (step > 0) setStep(step - 1);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="flex flex-col md:flex-row h-full md:h-[400px]">
                    {/* Visual Side */}
                    <div className={`${currentStep.color} w-full md:w-1/3 p-8 flex flex-col items-center justify-center text-center transition-colors duration-500`}>
                        <div className="text-8xl mb-4 animate-bounce-slow filter drop-shadow-lg">
                            {currentStep.icon}
                        </div>
                        <div className="flex gap-1 mt-8">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-white w-4' : 'bg-white/40'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="w-full md:w-2/3 p-8 flex flex-col">
                        <div className="flex-1 flex flex-col justify-center">
                            <h2 className="text-3xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                {currentStep.title}
                            </h2>
                            <p className="text-lg text-slate-300 leading-relaxed">
                                {currentStep.desc}
                            </p>
                        </div>

                        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-700/50">
                            <button
                                onClick={handlePrev}
                                disabled={step === 0}
                                className={`px-4 py-2 text-slate-400 hover:text-white transition-colors ${step === 0 ? 'opacity-0 cursor-default' : 'opacity-100'}`}
                            >
                                {t('previous')}
                            </button>

                            <button
                                onClick={handleNext}
                                className="px-6 py-2.5 bg-white text-slate-900 rounded-lg font-bold hover:bg-slate-200 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
                            >
                                {isLast ? t('finish') : t('next')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
