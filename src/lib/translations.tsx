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
        today: 'Today',
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
        search: 'Search...',
        settings: 'Settings',
        days_to_schedule: 'Days to schedule',
        start_date: 'Start Date',
        exclude_last_days: 'Exclude called in last X days',
        append_mode: 'Append to existing',
        append_mode_desc: 'Add to existing schedule instead of overwriting',
        generate: 'Generate Schedule',
        preview: 'Preview',
        generating: 'Generating...',

        // Mobile Schedule Planner
        suggestions_label: 'Suggestions',
        hot_label: 'Hot',
        top_5_label: 'Top 5',
        callbacks_label: 'Callbacks',
        mobile_step_1: '1. Select Regions',
        mobile_step_2: '2. Settings & Generate',
        showing_regions: 'Showing',
        showing_regions_suffix: 'regions',
        filter_cities_btn: 'Filter by City',
        hide_lists_btn: 'Hide Lists',
        next_configure: 'Next: Configure Schedule',
        back_to_selection: 'Back to Selection',
        selected_scope: 'Selected Scope',
        dentists_to_call: 'Dentists to call',
        team_capacity_daily: 'Team Capacity (Daily)',
        est_time: 'Est. Time Needed',
        schedule_duration_label: 'Schedule Duration',
        exclude_recent_label: 'Exclude Recently Called',
        keep_existing_desc: 'Keep existing assignments, only add new',
        generate_rocket: '🚀 Generate Schedule',
        priority_score: 'Priority',
        coverage_percent: 'Coverage',

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
        other: 'Other',
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
        import_dentists: 'Import Dentists',

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
        // Tutorial
        tutorial_title: 'Admin Dashboard Guide',
        tutorial_description: 'Welcome to your cold calling command center. Here is how to use it proficiently.',
        tut_schedule_title: '📅 Schedule Planner',
        tut_schedule_desc: 'Located in the Calendar tab. Click "Schedule Planner" to generate call assignments. Filter by region or city, set the date, and the system effectively distributes calls among available agents. It remembers which dentists were called recently and avoids them.',
        tut_stats_title: '📊 Statistics',
        tut_stats_desc: 'Track performance in real-time. See interested rates, daily progress, and top performers. Use "Weekly Comparison" to spot trends.',
        tut_calendar_title: '🗓️ Calendar View',
        tut_calendar_desc: 'Your weekly overview. Click on any day to see detailed assignments. You can delete specific day schedules if needed.',
        tut_users_title: '👥 Managing Callers',
        tut_users_desc: 'Add new callers in the "Users" tab. Set daily targets which affect how many calls they get assigned in the scheduler.',
        tut_export_title: '📥 Data Export & Import',
        tut_export_desc: 'Download full reports or import new data. You can drag and drop new JSON files to import them directly.',
        tut_campaigns_title: '🎯 Campaigns',
        tut_campaigns_desc: 'Track long-term progress. A campaign is automatically created when you generate a schedule. Monitor completion rates and outcomes here.',
        start_tutorial: 'Start Tutorial',
        next: 'Next',
        previous: 'Previous',
        finish: 'Finish',
    },
    bg: {
        // Tutorial
        tutorial_title: 'Ръководство за Админ Панел',
        tutorial_description: 'Добре дошли във вашия команден център. Ето как да го използвате ефективно.',
        tut_schedule_title: '📅 Планиране на График',
        tut_schedule_desc: 'Намира се в таб "Календар". Натиснете "Планиране на График" за да генерирате задачи. Филтрирайте по област или град, изберете дати, и системата автоматично разпределя обажданията. Тя помни кой кога е звънян и избягва повторения.',
        tut_stats_title: '📊 Статистика',
        tut_stats_desc: 'Следете представянето в реално време. Вижте процента на заинтересовани и дневния прогрес. Използвайте сравненията за да откриете тенденции.',
        tut_calendar_title: '🗓️ Календар',
        tut_calendar_desc: 'Вашият седмичен преглед. Натиснете върху ден за да видите детайли. Може да изтривате графици за конкретни дни.',
        tut_users_title: '👥 Управление на Служители',
        tut_users_desc: 'Добавяйте нови служители в таб "Потребители". Задавайте дневни цели, което определя колко обаждания ще получат.',
        tut_export_title: '📥 Експорт и Импорт',
        tut_export_desc: 'Сваляйте пълни отчети или добавяйте нови данни. Може да влачите нови JSON файлове за директен импорт.',
        tut_campaigns_title: '🎯 Кампании',
        tut_campaigns_desc: 'Следете дългосрочния прогрес. Кампания се създава автоматично при генериране на график. Следете успеваемостта тук.',
        start_tutorial: 'Начало',
        next: 'Напред',
        previous: 'Назад',
        finish: 'Край',

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
        today: 'Днес',
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
        search: 'Търсене...',
        settings: 'Настройки',
        days_to_schedule: 'Дни за планиране',
        start_date: 'Начална Дата',
        exclude_last_days: 'Изключи звънени от X дни',
        append_mode: 'Добави към съществуващи',
        append_mode_desc: 'Добавя към сегашния график вместо да го пренапише',
        generate: 'Генерирай График',
        preview: 'Преглед',
        generating: 'Генериране...',

        // Mobile Schedule Planner
        suggestions_label: 'Предложения',
        hot_label: 'Топ',
        top_5_label: 'Топ 5',
        callbacks_label: 'Повторни',
        mobile_step_1: '1. Избор на Области',
        mobile_step_2: '2. Настройки & Генериране',
        showing_regions: 'Показани',
        showing_regions_suffix: 'области',
        filter_cities_btn: 'Филтър по Град',
        hide_lists_btn: 'Скрий Списъци',
        next_configure: 'Напред: Конфигуриране',
        back_to_selection: 'Обратно към Избор',
        selected_scope: 'Избран Обхват',
        dentists_to_call: 'Зъболекари за контакт',
        team_capacity_daily: 'Дневен Капацитет',
        est_time: 'Прогнозно Време',
        schedule_duration_label: 'Продължителност',
        exclude_recent_label: 'Изключи скорошни',
        keep_existing_desc: 'Запази съществуващите, добави само нови',
        generate_rocket: '🚀 Генериране',
        priority_score: 'Приоритет',
        coverage_percent: 'Покритие',

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
        other: 'Друго',
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
        import_dentists: 'Импорт Зъболекари',

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
