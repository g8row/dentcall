# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project goal

DentCall is a cold-calling CRM for dental clinics. Admins create calling campaigns and generate daily assignment schedules; callers work through those assignments and log outcomes (INTERESTED, NOT_INTERESTED, NO_ANSWER, CALLBACK, ORDER_TAKEN). The system tracks analytics, sends daily email digests, and manages data imports from Excel.

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **SQLite** via `better-sqlite3` (single-file DB at `data/cold-caller.db`)
- **Tailwind CSS v4**
- **Zod** for request validation
- **jose** for JWT (Edge-compatible)
- **nodemailer** for email
- **Vitest** for tests

## Key conventions

### Adding API routes

1. Create route handler under `src/app/api/<resource>/route.ts`.
2. Extract user identity with `getUserFromHeaders(request.headers)` from `src/lib/api-response.ts`.
3. Validate request bodies with `validateBody(request, mySchema)` — schemas go in `src/lib/validation.ts`.
4. Return responses using helpers: `successResponse(data)`, `errorResponse(msg, status)`, `notFoundResponse()`, etc. — all from `src/lib/api-response.ts`. Never use `NextResponse.json()` directly.
5. If the route should be admin-only, add its prefix to `ADMIN_ROUTES` in `src/middleware.ts`.

### Database migrations

Never drop or recreate tables. Add columns with `ALTER TABLE` inside `getDb()` in `src/lib/db.ts`, guarded by a `pragma('table_info')` check:

```ts
const hasNewCol = columns.some(col => col.name === 'new_col');
if (!hasNewCol) {
  _db.exec(`ALTER TABLE table ADD COLUMN new_col TEXT`);
}
```

### Roles

- `ADMIN` — full access, manages users/campaigns/schedules/data
- `CALLER` — reads own assignments, logs calls, submits daily summaries

Callers must not access or modify other callers' data. Routes that need to be caller-specific should verify `x-user-id` matches the resource owner.

### i18n

All user-facing strings in client components must go through the translation context (`useTranslations()` from `src/lib/translations.tsx`). Add new keys to both `en` and `bg` objects.

### Call outcomes

The valid set is: `INTERESTED`, `NOT_INTERESTED`, `NO_ANSWER`, `CALLBACK`, `ORDER_TAKEN`. This enum appears in the Zod schemas (`validation.ts`) and directly in the DB — do not add new values without updating both.

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000
```

Default credentials (created on first boot): `admin` / `admin123` — must change on first login.

## Testing

```bash
npm run test:run                                    # all tests once
npx vitest run src/__tests__/auth.test.ts           # single file
npm run test:coverage                               # with coverage
```

Tests use `environment: 'node'` and the `@` alias points to `src/`.

## Files to be aware of

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Auth gate for all `/api/*` routes |
| `src/lib/db.ts` | DB singleton + schema + migrations |
| `src/lib/auth.ts` | JWT helpers, `getSession()`, password hashing |
| `src/lib/api-response.ts` | Response builders + `getUserFromHeaders` |
| `src/lib/validation.ts` | All Zod schemas + `validateBody`/`validateQuery` |
| `src/lib/scheduler.ts` | Background tasks (backup 03:00, email 18:00) |
| `src/lib/translations.tsx` | i18n context (en + bg) |
| `src/lib/email.ts` | SMTP email sending |
| `src/lib/backup.ts` | DB backup logic (keeps last 30) |
| `FUTURE_FEATURES.md` | Planned features with implementation plans |
| `REFACTORING.md` | Architecture diagrams and refactor suggestions |
