'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type Language = 'en' | 'bg';

const translations = {
    en: {
        // Common
        loading: 'Loading...',
        error: 'Error',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        back: 'Back',
        logout: 'Logout',

        // Login
        login_title: 'Cold Caller App',
        username: 'Username',
        password: 'Password',
        login_button: 'Login',

        // Admin Dashboard
        admin_title: 'Admin Dashboard',
        week_of: 'Week of',
        calendar: 'Calendar',
        role: 'Role',
        target: 'Daily Target',
        actions: 'Actions',
        add_caller: 'Add Caller',
        edit: 'Edit',
        campaigns: 'Campaigns',
        users: 'Users',
        data_export: 'Data Export',
        no_assignments: 'No assignments',
        per_caller: 'Per Caller',
        delete_day: 'Delete Day Schedule',

        // Schedule Planner
        schedule_planner: 'Schedule Planner',
        select_regions: 'Select Regions',
        select_all: 'Select All',
        clear: 'Clear',
        filter_cities: 'Filter by Cities',
        search_cities: 'Search cities...',
        settings: 'Settings',
        days_to_schedule: 'Days to schedule',
        start_date: 'Start Date',
        exclude_last_days: 'Exclude called in last X days',
        append_mode: 'Append to existing',
        append_mode_desc: 'Add to existing schedule instead of overwriting',
        generate: 'Generate Schedule',
        preview: 'Preview',
        generating: 'Generating...',

        // Stats / Outcomes
        total_assignments: 'Total Assignments',
        daily_capacity: 'Daily Capacity (est.)',
        available_dentists: 'Available Dentists',
        call_load: 'Call Load',

        // Colors/Status
        interested: 'Interested',
        not_interested: 'Not Interested',
        no_answer: 'No Answer',
        callback: 'Callback/Follow-up',
        follow_up: 'Follow Up',

        // Campaigns
        campaign_summary: 'Campaign Summary',
        no_campaigns: 'No campaigns yet',
        generate_hint: 'Generate a schedule to create your first campaign',
        active: 'Active',
        completed: 'Completed',
        progress: 'Progress',

        // Caller Dashboard
        caller_dashboard: 'Caller Dashboard',
        today_assignments: 'Today\'s Assignments',
        history: 'History',
        make_call: 'Make Call',
        call_outcome: 'Call Outcome',
        notes_placeholder: 'Add notes here...',
        submit: 'Submit',

        // Export
        export_dentists: 'Export All Dentists',
        export_calls: 'Export Call Logs',
        export_stats: 'Export Caller Stats',

        // Dashboard Statistics
        statistics: 'Statistics',
        dashboard_overview: 'Overview',
        total_dentists: 'Total Dentists',
        total_calls: 'Total Calls',
        interested_rate: 'Interested Rate',
        active_callers: 'Active Callers',
        today_progress: 'Today\'s Progress',
        coverage_rate: 'Coverage Rate',
        pending_callbacks: 'Pending Callbacks',

        // Regions
        region_coverage: 'Region Coverage',
        region: 'Region',
        dentists: 'Dentists',
        called: 'Called',
        coverage: 'Coverage',
        interest_rate_col: 'Interest Rate',

        // Callers
        caller_performance: 'Caller Performance',
        caller: 'Caller',
        calls_today: 'Today',
        calls_total: 'Total',
        avg_per_day: 'Avg/Day',
        days_active: 'Days Active',

        // Daily Stats
        daily_activity: 'Daily Activity',
        last_30_days: 'Last 30 Days',
        calls: 'Calls',

        // Outcomes
        outcome_distribution: 'Outcome Distribution',

        // Recent Calls
        recent_calls: 'Recent Calls',
        time: 'Time',
        facility: 'Facility',
        outcome: 'Outcome',
        notes: 'Notes',
        view_all: 'View All',

        // Weekly comparison
        weekly_comparison: 'Weekly Comparison',
        this_week: 'This Week',
        last_week: 'Last Week',
        change: 'Change',
        top_performers: 'Top Performers',
        top_regions: 'Top Regions',
        no_data: 'No data available',

        // Reset Password
        reset_password_title: 'Reset Password',
        reset_password_subtitle: 'Please set a new password to continue',
        new_password: 'New Password',
        confirm_password: 'Confirm Password',
        enter_new_password: 'Enter new password',
        confirm_new_password: 'Confirm new password',
        reset_password_button: 'Set Password',
        passwords_not_match: 'Passwords do not match',
        password_too_short: 'Password must be at least 6 characters',
    },
    bg: {
        // Common
        loading: 'Зареждане...',
        error: 'Грешка',
        save: 'Запази',
        cancel: 'Отказ',
        delete: 'Изтрий',
        back: 'Назад',
        logout: 'Изход',

        // Login
        login_title: 'Студени Обаждания',
        username: 'Потребител',
        password: 'Парола',
        login_button: 'Вход',

        // Admin Dashboard
        admin_title: 'Админ Панел',
        week_of: 'Седмица от',
        calendar: 'Календар',
        role: 'Роля',
        target: 'Дневна Цел',
        actions: 'Действия',
        add_caller: 'Добави',
        edit: 'Редактирай',
        campaigns: 'Кампании',
        users: 'Потребители',
        data_export: 'Експорт Данни',
        no_assignments: 'Няма задачи',
        per_caller: 'По служител',
        delete_day: 'Изтрий График за Деня',

        // Schedule Planner
        schedule_planner: 'Планиране на График',
        select_regions: 'Избери Области',
        select_all: 'Избери Всички',
        clear: 'Изчисти',
        filter_cities: 'Филтър по Градове',
        search_cities: 'Търси град...',
        settings: 'Настройки',
        days_to_schedule: 'Дни за планиране',
        start_date: 'Начална Дата',
        exclude_last_days: 'Изключи звънени от X дни',
        append_mode: 'Добави към съществуващи',
        append_mode_desc: 'Добавя към сегашния график вместо да го пренапише',
        generate: 'Генерирай График',
        preview: 'Преглед',
        generating: 'Генериране...',

        // Stats / Outcomes
        total_assignments: 'Общо Задачи',
        daily_capacity: 'Дневен Капацитет (прибл.)',
        available_dentists: 'Налични Зъболекари',
        call_load: 'Натоварване',

        // Colors/Status
        interested: 'Заинтересован',
        not_interested: 'Не се интересува',
        no_answer: 'Няма отговор',
        callback: 'Обратна връзка',
        follow_up: 'Последващо',

        // Campaigns
        campaign_summary: 'Кампании',
        no_campaigns: 'Няма кампании',
        generate_hint: 'Генерирай график за да създадеш първа кампания',
        active: 'Активна',
        completed: 'Приключена',
        progress: 'Прогрес',

        // Caller Dashboard
        caller_dashboard: 'Панел Служител',
        today_assignments: 'Задачи за Деня',
        history: 'История',
        make_call: 'Обади се',
        call_outcome: 'Резултат',
        notes_placeholder: 'Бележки...',
        submit: 'Запиши',

        // Export
        export_dentists: 'Експорт Зъболекари',
        export_calls: 'Експорт История Обаждания',
        export_stats: 'Експорт Статистика',

        // Dashboard Statistics
        statistics: 'Статистика',
        dashboard_overview: 'Преглед',
        total_dentists: 'Общо Зъболекари',
        total_calls: 'Общо Обаждания',
        interested_rate: 'Процент Заинтересовани',
        active_callers: 'Активни Служители',
        today_progress: 'Прогрес Днес',
        coverage_rate: 'Покритие',
        pending_callbacks: 'Чакащи Обратни Обаждания',

        // Regions
        region_coverage: 'Покритие по Области',
        region: 'Област',
        dentists: 'Зъболекари',
        called: 'Обадени',
        coverage: 'Покритие',
        interest_rate_col: 'Процент Интерес',

        // Callers
        caller_performance: 'Представяне на Служители',
        caller: 'Служител',
        calls_today: 'Днес',
        calls_total: 'Общо',
        avg_per_day: 'Ср./Ден',
        days_active: 'Активни Дни',

        // Daily Stats
        daily_activity: 'Дневна Активност',
        last_30_days: 'Последни 30 Дни',
        calls: 'Обаждания',

        // Outcomes
        outcome_distribution: 'Разпределение Резултати',

        // Recent Calls
        recent_calls: 'Последни Обаждания',
        time: 'Час',
        facility: 'Денталец',
        outcome: 'Резултат',
        notes: 'Бележки',
        view_all: 'Виж Всички',

        // Weekly comparison
        weekly_comparison: 'Седмично Сравнение',
        this_week: 'Тази Седмица',
        last_week: 'Миналата Седмица',
        change: 'Промяна',
        top_performers: 'Топ Служители',
        top_regions: 'Топ Области',
        no_data: 'Няма налични данни',

        // Reset Password
        reset_password_title: 'Смяна на парола',
        reset_password_subtitle: 'Моля задайте нова парола за да продължите',
        new_password: 'Нова Парола',
        confirm_password: 'Потвърди Парола',
        enter_new_password: 'Въведете нова парола',
        confirm_new_password: 'Потвърдете новата парола',
        reset_password_button: 'Задай Парола',
        passwords_not_match: 'Паролите не съвпадат',
        password_too_short: 'Паролата трябва да е поне 6 символа',
    }
};

const LanguageContext = createContext<{
    lang: Language;
    setLang: (lang: Language) => void;
    t: (key: keyof typeof translations['en']) => string;
}>({
    lang: 'en',
    setLang: () => { },
    t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>('en');

    useEffect(() => {
        const saved = localStorage.getItem('app_lang') as Language;
        if (saved && (saved === 'en' || saved === 'bg')) {
            setLangState(saved);
        }
    }, []);

    const setLang = (newLang: Language) => {
        setLangState(newLang);
        localStorage.setItem('app_lang', newLang);
    };

    const t = (key: keyof typeof translations['en']) => {
        return translations[lang][key] || translations['en'][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }
        }>
            {children}
        </LanguageContext.Provider>
    );
}

export const useTranslation = () => useContext(LanguageContext);
