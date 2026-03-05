# Project Overview

## Purpose
A cold-calling management system for dental clinic outreach. Admins create call schedules, callers execute calls, and the system tracks outcomes and statistics.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1 (App Router) |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS v4 (dark theme) |
| Database | SQLite via `better-sqlite3` |
| Auth | JWT (jose) with HTTP-only cookies |
| Validation | Zod |
| Testing | Vitest + Testing Library |
| Date Handling | date-fns |
| Export | xlsx (Excel generation) |

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API
│   ├── page.tsx           # Login page
│   ├── admin/             # Admin dashboard
│   │   └── page.tsx       # Admin page (tabs: Stats, Calendar, Planner, Database, Users, Data, Daily Summaries)
│   ├── caller/            # Caller dashboard
│   │   ├── page.tsx       # Caller assignments & call logging
│   │   └── daily-summary/ # Daily summary submission page
│   ├── reset-password/    # Password reset
│   └── api/               # API routes
│       ├── auth/          # login, logout, session, reset-password
│       ├── users/         # User CRUD
│       ├── dentists/      # Dentist CRUD, import, locations, regions
│       ├── calls/         # Call logging
│       ├── assignments/   # Schedule generation
│       ├── campaigns/     # Campaign management
│       ├── stats/         # Dashboard, outcomes, regions, schedule-planner
│       ├── daily-summaries/ # Daily summary CRUD
│       ├── daily-email/   # Daily email report generation & sending
│       ├── data/          # Delete history endpoint
│       ├── export/        # Data export
│       └── admin/         # Admin actions (backup)
├── components/            # Reusable React components
│   ├── StatsDashboard.tsx     # Statistics display with charts
│   ├── SchedulePlanner.tsx    # Schedule generation UI with region/city/caller selection
│   ├── DentistManager.tsx     # Dentist CRUD UI with pagination & filtering
│   ├── DailySummariesView.tsx # Admin view of daily summaries with export & email
│   ├── EditDentistModal.tsx   # Edit dentist form
│   ├── AddDentistModal.tsx    # Add dentist form
│   ├── ConfirmModal.tsx       # Confirmation dialogs
│   ├── AdminTutorial.tsx      # Tutorial overlay
│   ├── SchedulingInfoModal.tsx # Scheduling logic info
│   └── LanguageSwitcher.tsx   # EN/BG toggle
├── lib/                   # Shared utilities
│   ├── db.ts              # Database connection, schema & migrations
│   ├── auth.ts            # JWT auth, session, password hashing
│   ├── translations.tsx   # i18n (EN/BG)
│   ├── validation.ts      # Zod schemas for all API endpoints
│   ├── api-response.ts    # Standardized API responses (success/error/paginated)
│   ├── email.ts           # Email generation & sending (daily summaries)
│   ├── rate-limit.ts      # Rate limiting (login endpoint)
│   ├── logger.ts          # Logging utility with log levels
│   ├── scheduler.ts       # Backup scheduling helpers
│   └── backup.ts          # Database backup logic
├── __tests__/             # Test suite
│   ├── api-response.test.ts
│   ├── auth.test.ts
│   ├── logger.test.ts
│   ├── rate-limit.test.ts
│   ├── validation.test.ts
│   ├── validation-edge-cases.test.ts
│   └── setup.ts
└── middleware.ts          # Centralized auth middleware (Edge-compatible)
```

## Database Schema

### Tables
- **users**: `id, username, display_name, password, role (ADMIN|CALLER), daily_target, must_reset_password, created_at`
- **dentists**: `id, facility_name, region, manager, phones (JSON), services, cities_served, locations, staff, staff_count, preferred_caller_id, wants_implants, eik, created_at`
- **calls**: `id, dentist_id, caller_id, outcome (INTERESTED|NOT_INTERESTED|NO_ANSWER|CALLBACK|ORDER_TAKEN), notes, called_at`
- **assignments**: `id, date, dentist_id, caller_id, campaign_id, completed, notes, created_at`
- **campaigns**: `id, name, description, start_date, end_date, target_regions, target_cities, target_callers, status (ACTIVE|COMPLETED|CANCELLED), created_at, completed_at, cancelled_at`
- **daily_summaries**: `id, caller_id, summary_date, summary_notes, call_count, call_ids, created_at`

### Key Indexes
- Compound indexes on `assignments(date, caller_id)`, `calls(dentist_id, called_at)`, `dentists(region, cities_served)`
- Individual indexes on all foreign keys and common filter columns
- Daily summaries indexed on `(caller_id, summary_date)` with UNIQUE constraint

## Middleware (Centralized Auth)

Edge-compatible JWT verification in `src/middleware.ts`:
- **Public routes**: `/api/auth/login`, `/api/auth/session`
- **Admin-only routes**: `/api/admin/*`, `/api/users/*`, `/api/campaigns/*`
- Injects `x-user-id` and `x-user-role` headers for downstream handlers

## User Roles

| Role | Access |
|------|--------|
| ADMIN | Full access - can manage users, dentists, schedules, view all stats, daily summaries, email reports |
| CALLER | Can view their assignments, log calls, submit daily summaries, see their own stats |

## Environment Variables

```env
JWT_SECRET=your-secret-key        # Required for auth (must be set in production)
NODE_ENV=development|production
CORS_ORIGIN=https://yourdomain.com  # Allowed CORS origin
LOG_LEVEL=warn                      # debug|info|warn|error
INSECURE_COOKIES=true               # For local HTTP development

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=DentCall <your-email@gmail.com>
EMAIL_TO=admin1@company.com,admin2@company.com
DAILY_EMAIL_API_KEY=your-secret-key
```
