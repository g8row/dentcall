# Code Flows & Business Logic

## Authentication Flow

```
1. User visits /
2. If no session → show login form
3. Login → POST /api/auth/login
   - Validate credentials
   - Create JWT, set HTTP-only cookie
   - Return user info + redirect path
4. If must_reset_password → redirect to /reset-password
5. Based on role:
   - ADMIN → /admin
   - CALLER → /caller
```

### Middleware (Centralized Auth)

```
Every API request hits middleware.ts:

1. Check if route is public → pass through
2. Extract JWT from auth-token cookie
3. Verify with jose (Edge-compatible, no DB access)
4. Check admin-only routes → enforce role
5. Inject x-user-id and x-user-role headers
6. Pass to route handler
```

## Schedule Generation Flow

```
Admin clicks "Generate Schedule" in SchedulePlanner:

1. POST /api/assignments
   ├─ Filters: regions, cities, callers, excludeDays
   ├─ Query eligible dentists:
   │   - Not INTERESTED/NOT_INTERESTED/ORDER_TAKEN (terminal states)
   │   - Not called within excludeDays
   │   - Match region/city filters
   │
   ├─ Priority sorting:
   │   1. CALLBACK status (highest priority)
   │   2. Never called
   │   3. Oldest last call
   │
   ├─ Distribution logic (preferred-first):
   │   - Preferred callers get their assigned dentists first
   │   - Common pool dentists distributed to fill daily_target
   │
   └─ Create campaign + assignments
   
2. Calendar updates to show new assignments
```

### Campaign Duplication Flow

```
Admin clicks "Duplicate" on a campaign:

1. Campaign regions, cities, and callers are extracted
2. SchedulePlanner opens with pre-filled selections
3. Admin can adjust and generate new schedule
```

## Call Logging Flow

```
Caller clicks "Make Call" then selects outcome:

1. POST /api/calls
   ├─ Create call record
   ├─ Sync assignment notes to call (if draft notes exist)
   ├─ Update assignment (completed = 1)
   └─ Dentist status changes based on outcome:
       - INTERESTED → removed from future scheduling
       - NOT_INTERESTED → removed from future scheduling
       - ORDER_TAKEN → removed from future scheduling
       - NO_ANSWER → eligible again after excludeDays
       - CALLBACK → prioritized in next schedule

2. UI refreshes remaining assignments
```

### Edit Call Flow

```
Caller can edit a previously logged call:

1. PATCH /api/calls/[id]
   ├─ Update outcome and/or notes
   └─ Original dentist_id preserved

2. Changed outcome affects future scheduling eligibility
```

## Save Draft (Assignment Notes) Flow

```
Caller writes notes before making a call:

1. PATCH /api/assignments/[id]
   ├─ Save notes field on assignment
   └─ UI shows "Draft saved" confirmation

2. When call is logged:
   ├─ Assignment notes synced to call record
   └─ Assignment marked as completed
```

## Re-queuing Logic (Exclude Days)

Dentists cycle back based on outcomes:

| Outcome | Re-queue After |
|---------|----------------|
| NO_ANSWER | X days (configurable, default 7) |
| CALLBACK | X days, but prioritized |
| INTERESTED | Never (terminal) |
| NOT_INTERESTED | Never (terminal) |
| ORDER_TAKEN | Never (terminal) |

## Preferred Caller System

```
Dentist has preferred_caller_id → Only that caller is assigned

Distribution order:
1. Each caller gets their "preferred" dentists first
2. After preferred pool is exhausted, fill from common pool
3. Daily target determines how many each caller gets
```

## Data Flow: Admin Dashboard

```
/admin page loads:

1. Fetch session → verify ADMIN role
2. Load initial data in parallel:
   ├─ GET /api/users → user list
   ├─ GET /api/dentists/regions → regions for filters
   └─ GET /api/assignments?date=... → calendar data

3. Tab-specific data:
   - Stats tab → StatsDashboard component
   - Calendar tab → week/month view with day detail modals
   - Planner tab → SchedulePlanner component
   - Database tab → DentistManager component
   - Users tab → user CRUD (create, edit, reset password, deactivate)
   - Data tab → export/import, delete history
   - Daily Summaries tab → DailySummariesView component
```

## Data Flow: Caller Dashboard

```
/caller page loads:

1. Fetch session → verify CALLER role
2. Load assignments:
   GET /api/assignments?caller_id={userId}&date={today}
   
3. For each assignment, dentist info is included
4. Caller can:
   - Save draft notes (PATCH assignment)
   - Make call → outcome modal → POST /api/calls
   - Edit previous call → PATCH /api/calls/[id]
   - Update EIK on dentist → PATCH /api/dentists/[id]
5. Assignment moves to History tab
6. Daily summary link in header → /caller/daily-summary
```

## Daily Summary Flow

```
Caller submits daily summary:

1. Navigate to /caller/daily-summary
2. Page loads:
   ├─ GET /api/calls?caller_id={userId}&date={today}
   ├─ GET /api/daily-summaries?summary_date={today}
   └─ Pre-fill if existing summary found

3. Submit → POST /api/daily-summaries
   ├─ Creates or updates summary for date
   ├─ Stores summary_notes, call_count, call_ids
   └─ UNIQUE(caller_id, summary_date) prevents duplicates
```

## Daily Email Flow

```
Admin triggers email or cron hits endpoint:

1. GET/POST /api/daily-email?date={date}
   ├─ Auth: Admin session OR api_key query param
   ├─ Fetch all calls for date with outcomes
   ├─ Fetch all daily_summaries for date
   ├─ Generate HTML email via generateDailySummaryEmail()
   ├─ Send via sendEmail() (nodemailer or console fallback)
   └─ Return email preview data
```

## Migration Pattern

When adding new database columns:

```typescript
// In src/lib/db.ts, after table creation

// Get existing columns
const columns = db.pragma('table_info(tablename)') as { name: string }[];

// Check if column exists
const hasNewColumn = columns.some(col => col.name === 'new_column');
if (!hasNewColumn) {
    db.exec(`ALTER TABLE tablename ADD COLUMN new_column TYPE`);
    // Backfill if needed
    db.exec(`UPDATE tablename SET new_column = default_value WHERE new_column IS NULL`);
    logger.migration('Added new_column to tablename');
}
```
