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

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API
│   ├── page.tsx           # Login page
│   ├── admin/             # Admin dashboard
│   ├── caller/            # Caller dashboard
│   ├── reset-password/    # Password reset
│   └── api/               # API routes
│       ├── auth/          # login, logout, session, reset-password
│       ├── users/         # User CRUD
│       ├── dentists/      # Dentist CRUD, import, locations, regions
│       ├── calls/         # Call logging
│       ├── assignments/   # Schedule generation
│       ├── campaigns/     # Campaign management
│       ├── stats/         # Dashboard, outcomes, regions, schedule-planner
│       ├── data/          # Delete history endpoint
│       ├── export/        # Data export
│       └── admin/         # Admin actions (backup)
├── components/            # Reusable React components
│   ├── StatsDashboard.tsx     # Statistics display
│   ├── SchedulePlanner.tsx    # Schedule generation UI
│   ├── DentistManager.tsx     # Dentist CRUD UI
│   ├── EditDentistModal.tsx   # Edit dentist form
│   ├── AddDentistModal.tsx    # Add dentist form
│   ├── ConfirmModal.tsx       # Confirmation dialogs
│   ├── AdminTutorial.tsx      # Tutorial overlay
│   ├── SchedulingInfoModal.tsx # Scheduling logic info
│   └── LanguageSwitcher.tsx   # EN/BG toggle
├── lib/                   # Shared utilities
│   ├── db.ts              # Database connection & schema
│   ├── auth.ts            # JWT auth, session, password hashing
│   ├── translations.tsx   # i18n (EN/BG)
│   ├── validation.ts      # Zod schemas
│   ├── api-response.ts    # Standardized API responses
│   ├── rate-limit.ts      # Rate limiting
│   ├── logger.ts          # Logging utility
│   ├── scheduler.ts       # Scheduling helpers
│   └── backup.ts          # Database backup logic
└── middleware.ts          # Route protection
```

## Database Schema

### Tables
- **users**: `id, username, display_name, password, role (ADMIN|CALLER), daily_target, must_reset_password, created_at`
- **dentists**: `id, facility_name, region, manager, phones (JSON), services, cities_served, locations, staff, staff_count, preferred_caller_id, eik, created_at`
- **calls**: `id, dentist_id, caller_id, outcome (INTERESTED|NOT_INTERESTED|NO_ANSWER|CALLBACK|ORDER_TAKEN|OTHER), notes, called_at`
- **assignments**: `id, date, dentist_id, caller_id, campaign_id, completed, created_at`
- **campaigns**: `id, name, start_date, end_date, region_filter, status (ACTIVE|COMPLETED|CANCELLED), created_at`

## User Roles

| Role | Access |
|------|--------|
| ADMIN | Full access - can manage users, dentists, schedules, view all stats |
| CALLER | Can view their assignments, log calls, see their own stats |

## Environment Variables

```env
JWT_SECRET=your-secret-key  # Required for auth
NODE_ENV=development|production
```
