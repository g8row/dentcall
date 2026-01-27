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

## Call Outcome States

| Outcome | Terminal? | Re-schedule? |
|---------|-----------|--------------|
| `INTERESTED` | Yes | Never |
| `NOT_INTERESTED` | Yes | Never |
| `ORDER_TAKEN` | Yes | Never |
| `NO_ANSWER` | No | After X days |
| `CALLBACK` | No | Prioritized next schedule |
| `OTHER` | No | After X days |

## EIK/BULSTAT

Bulgarian business registration number for dental practices:
- Field: `eik` in dentists table
- Used for business verification
- Optional field in add/edit forms
