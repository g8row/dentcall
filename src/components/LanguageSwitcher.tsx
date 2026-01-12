'use client';
import { useTranslation } from '@/lib/translations';

export default function LanguageSwitcher() {
    const { lang, setLang } = useTranslation();

    return (
        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${lang === 'en'
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                EN
            </button>
            <button
                onClick={() => setLang('bg')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${lang === 'bg'
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                BG
            </button>
        </div>
    );
}
