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

## Schedule Generation Flow

```
Admin clicks "Generate Schedule" in SchedulePlanner:

1. POST /api/assignments
   ├─ Filters: regions, cities, callers, excludeDays
   ├─ Query eligible dentists:
   │   - Not INTERESTED/NOT_INTERESTED (terminal states)
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

## Call Logging Flow

```
Caller clicks "Make Call" then selects outcome:

1. POST /api/calls
   ├─ Create call record
   ├─ Update assignment (completed = 1)
   └─ Dentist status changes based on outcome:
       - INTERESTED → removed from future scheduling
       - NOT_INTERESTED → removed from future scheduling
       - ORDER_TAKEN → removed from future scheduling
       - NO_ANSWER → eligible again after excludeDays
       - CALLBACK → prioritized in next schedule
       - OTHER → varies

2. UI refreshes remaining assignments
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
   - Calendar tab → week/month view, SchedulePlanner
   - Database tab → DentistManager component
   - Users tab → user CRUD
   - Data tab → export/import, delete history
```

## Data Flow: Caller Dashboard

```
/caller page loads:

1. Fetch session → verify CALLER role
2. Load assignments:
   GET /api/assignments?caller_id={userId}&date={today}
   
3. For each assignment, dentist info is included
4. Caller clicks "Make Call" → outcome modal
5. Submit outcome → POST /api/calls
6. Assignment moves to History tab
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
