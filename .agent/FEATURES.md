# Custom Features

This document covers specialized features that are unique to this project.

## Virtual Regions

The schedule planner includes "virtual regions" that aren't real geographic areas but special filtered views:

### 1. User Client Regions (`★ Клиенти [Name]`)

- **What it is**: A virtual region for dentists assigned to a specific caller via `preferred_caller_id`
- **Purpose**: Allows admins to schedule ONLY the preferred dentists for a specific caller
- **Display Format**: `★ Клиенти [display_name or username]`
- **Key Behavior**:
  - When selected, the scheduler ONLY includes dentists where `preferred_caller_id` matches the user
  - Cannot be mixed with other callers (API returns error if incompatible caller is selected)
  - Highest priority score (9999) - appears at top of region list

### 2. Implants Region (`🦷 Импланти`)

- **What it is**: Virtual region for dentists interested in implants
- **Purpose**: Quick access to all implant-interested dentists across all geographic regions
- **Key Behavior**:
  - Filters by `wants_implants = 1` in the dentists table
  - Excludes dentists with preferred callers (those go through their user region)
  - Priority score: 8888

## Preferred Caller System

Dentists can be assigned a "preferred caller" - only that caller will handle them.

### How it works:
1. **Assignment**: Set via `preferred_caller_id` on the dentist record
2. **Scheduling**: When generating schedules:
   - Preferred dentists go to their assigned caller FIRST
   - Then common pool dentists fill remaining capacity
3. **Display**: Uses `display_name` (Bulgarian) with fallback to `username` (English)
4. **Virtual Regions**: Creates `★ Клиенти [Name]` regions in schedule planner

### "Removing" from Region

When a dentist has a preferred caller:
1. They're **excluded** from geographic region counts
2. They appear ONLY in the virtual `★ Клиенти [Name]` region
3. Purpose: Prevents double-counting and ensures exclusive assignment

```sql
-- Geographic regions exclude preferred dentists:
AND (d.preferred_caller_id IS NULL)

-- Virtual regions include ONLY preferred dentists:
AND d.preferred_caller_id = ?
```

### "Copying" Behavior

The preferred breakdown tooltip (★ indicator) shows:
- Which callers have preferred dentists in a region
- How many preferred dentists each caller has

This lets admins understand the distribution without selecting the virtual region.

## Implants Feature (`wants_implants`)

Track dentists interested in implants services.

### Database:
- Column: `wants_implants` (INTEGER, 0 or 1)
- Location: `dentists` table

### Usage:
1. Import sets it from source data
2. Virtual region `🦷 Импланти` shows all implant-interested dentists
3. Scheduling filters by this flag when that region is selected

## Display Name System

Two name fields for users:

| Field | Purpose | Language |
|-------|---------|----------|
| `username` | Login credential | English |
| `display_name` | UI display | Bulgarian |

### Display Priority:
All UI uses: `display_name || username` (fallback to username if display_name is null)

### Affected Areas:
- Admin user table
- Schedule planner caller list
- Virtual region names (`★ Клиенти [Name]`)
- Calendar caller breakdown
- Add/Edit dentist modals (preferred caller dropdown)
- DentistManager preferred caller column
- Assignment API responses
- Daily summaries caller names

## Call Outcome States

| Outcome | Terminal? | Re-schedule? |
|---------|-----------|--------------|
| `INTERESTED` | Yes | Never |
| `NOT_INTERESTED` | Yes | Never |
| `ORDER_TAKEN` | Yes | Never |
| `NO_ANSWER` | No | After X days |
| `CALLBACK` | No | Prioritized next schedule |

## EIK/BULSTAT

Bulgarian business registration number for dental practices:
- Field: `eik` in dentists table
- Used for business verification
- Optional field in add/edit forms
- Editable by callers directly from their dashboard

## Assignment Notes (Save Draft)

Callers can save draft notes on assignments before making a call:
- Field: `notes` TEXT column on `assignments` table
- Notes are saved via PATCH to the assignment
- When a call is logged, assignment notes are synced to the call record
- Visible in the caller UI as a "Save Draft" button

## Campaign Management

### Campaign Lifecycle:
- **ACTIVE** → assignments being generated and worked
- **COMPLETED** → manually marked complete
- **CANCELLED** → cancellation also deletes future uncompleted assignments

### Campaign Duplication:
Admins can duplicate a campaign, pre-filling the schedule planner with the original campaign's regions, cities, and callers.

### Campaign Schema:
```sql
campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  target_regions TEXT,    -- JSON array
  target_cities TEXT,     -- JSON array
  target_callers TEXT,    -- JSON array
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT
)
```

## Daily Summaries

Callers can submit daily work summaries that are visible to admins.

### For Callers

**Submission (`/caller/daily-summary`):**
- Free-text summary of work day
- Automatic attachment of calls made that day
- Can update existing summary for same date
- Accessible via button in caller dashboard header

### For Admins

**Viewing (`Admin Dashboard > Daily Summaries tab`):**
- View all caller summaries
- Filter by caller, date range
- Export to CSV
- Statistics: total summaries, calls reported, active reporters

**Email Reports:**
- Manual trigger via "Send Daily Email" button
- Automated via cron job (see `docs/DAILY_EMAIL.md`)
- Contains:
  - Call statistics (total, interested rate, callbacks)
  - Individual caller summaries
  - System logs and warnings
  - Formatted HTML email

### Database

```sql
daily_summaries (
  id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL,
  summary_date TEXT NOT NULL,
  summary_notes TEXT NOT NULL,
  call_count INTEGER NOT NULL,
  call_ids TEXT,  -- Comma-separated list of call IDs
  created_at TEXT NOT NULL,
  UNIQUE(caller_id, summary_date)
)
```

### API Endpoints

- `GET /api/daily-summaries` - Retrieve summaries (callers see own, admins see all)
- `POST /api/daily-summaries` - Submit or update summary
- `GET /api/daily-email` - Generate and send email report (admin only)

### Email Configuration

Requires environment variables:
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`
- `EMAIL_FROM`, `EMAIL_TO` (comma-separated recipients)
- `DAILY_EMAIL_API_KEY` (for cron job authentication)

See `docs/DAILY_EMAIL.md` for detailed setup instructions.
