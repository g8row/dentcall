# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm start            # Run production server
npm run lint         # ESLint
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage
docker compose up -d # Run in Docker (port 4000, SQLite in named volume)
```

To run a single test file:
```bash
npx vitest run src/__tests__/auth.test.ts
```

## Architecture

**DentCall** is a cold-calling CRM for dental clinics. Two user roles: `ADMIN` (manages campaigns, scheduling, analytics) and `CALLER` (works through daily assignment queues, logs call outcomes).

### Request flow

1. `src/middleware.ts` — Edge-compatible JWT verification (via `jose`). Reads `auth-token` cookie, writes `x-user-id` and `x-user-role` headers for downstream handlers. Admin-only route list is defined here.
2. API route handlers extract the user from headers via `getUserFromHeaders()` in `src/lib/api-response.ts`.
3. All API responses use helpers from `src/lib/api-response.ts`: `successResponse`, `errorResponse`, `notFoundResponse`, etc.
4. Request bodies are validated with Zod schemas from `src/lib/validation.ts` using `validateBody(req, schema)`.

### Database

`src/lib/db.ts` exports a lazy singleton `better-sqlite3` instance (WAL mode). Schema is created with `CREATE TABLE IF NOT EXISTS` on first connection. **Migrations are inline**: each migration checks `pragma('table_info(table)')` before `ALTER TABLE`, so they run idempotently on every startup. Add new migrations at the bottom of `getDb()` using this same pattern.

Database file lives at `data/cold-caller.db` (created at runtime, not committed). In Docker it's in a named volume.

### Core data model

- `users`: id, username, display_name, password (bcrypt), role (ADMIN/CALLER), daily_target
- `dentists`: facility_name, region, cities_served, phones (JSON), preferred_caller_id (FK→users)
- `calls`: dentist_id, caller_id, outcome (INTERESTED/NOT_INTERESTED/NO_ANSWER/CALLBACK/ORDER_TAKEN), notes
- `assignments`: date, dentist_id, caller_id, campaign_id, completed, notes (draft)
- `campaigns`: date range, target_regions/cities/callers (JSON arrays), status
- `daily_summaries`: caller daily EOD reports with attached call IDs

### Auth

JWT tokens (7-day expiry, HS256) stored as `httpOnly` cookies. `src/lib/auth.ts` handles token creation/verification and `getSession()` for server components. The middleware does the same verification using `jose` only (no DB access) for Edge compatibility.

Default admin on first boot: `admin` / `admin123` (must reset on first login).

### Background tasks

`src/lib/scheduler.ts` uses `setTimeout`/`setInterval` for:
- **03:00 AM** — automated DB backup (`src/lib/backup.ts`, keeps last 30 in `data/backups/`)
- **18:00** — daily summary email via SMTP (`src/lib/email.ts`)

The scheduler is initialized once on server start.

### i18n

`src/lib/translations.tsx` provides a React context with English (`en`) and Bulgarian (`bg`). Use the `useTranslations()` hook in client components. Language is stored in `localStorage`.

### Key components

- `src/components/SchedulePlanner.tsx` — schedule generation UI (region/city/caller filtering, workload balancing, campaign duplication)
- `src/components/StatsDashboard.tsx` — KPI cards, daily performance table, outcome distribution
- `src/components/DentistManager.tsx` — raw dentist record management, preferred caller assignment
- `src/app/caller/` — mobile-optimized caller interface with assignment queue

## Environment variables

Required in production: `JWT_SECRET`

Optional: `CORS_ORIGIN`, `LOG_LEVEL`, `INSECURE_COOKIES=true` (for HTTP dev), `EMAIL_HOST/PORT/USER/PASSWORD/FROM/TO`, `DAILY_EMAIL_API_KEY` (for cron-triggered email endpoint)

## Tests

Tests live in `src/__tests__/` and use Vitest with `environment: 'node'`. Path alias `@` maps to `src/`. Tests import from `src/lib/` directly — no mocking of the DB (tests use in-memory or temp DBs via setup in `src/__tests__/setup.ts`).
