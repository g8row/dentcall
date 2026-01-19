# Known Issues

## 🔴 Critical / Breaking

### ~~1. Schema Mismatch in Dentist Creation~~ ✅ FIXED
**Location**: `src/app/api/dentists/route.ts` (POST handler)
**Status**: Fixed in commit `e501d9d`
**Solution**: Removed invalid `address`/`email` columns from INSERT; address now stored in `locations` JSON field.

### ~~2. No Route Protection / Middleware~~ ✅ FIXED
**Location**: `src/middleware.ts` (new file)
**Status**: Fixed in commit `e501d9d`
**Solution**: Added Edge-compatible auth middleware that validates JWT tokens and enforces role-based access.

---

## 🟠 Medium Priority

### 3. Phone Number Overlap Between CSVs
**Location**: Data import pipeline (`scripts/assign_preferred_callers.py`, CSV files)
**Status**: Documented but unresolved
**Problem**: Some phone numbers appear in both `klienti_dani.csv` and `klienti_ico.csv`. Currently assigning to the first match (Dani).
**Impact**: Incorrect preferred caller assignments for some dentists.
**Fix**: Implement conflict resolution policy—either prompt admin during import or use a priority/timestamp rule.

### 4. Phone Number Format Inconsistencies
**Location**: `dentists.phones` field, import scripts
**Problem**: CSV files contain mixed formats (dashes, spaces, country prefixes). Normalization exists but edge cases may slip through.
**Impact**: Duplicate detection failures; poor search results; tel: links may not work consistently.
**Fix**: Implement stricter phone normalization at import time and add validation to the Add/Edit Dentist modals.

### 5. Large List Performance
**Location**: `SchedulePlanner.tsx`, `DentistManager.tsx`, `StatsDashboard.tsx`
**Status**: Documented in original ISSUES.md
**Problem**: Thousands of rows render without virtualization. Region lists fetch all data at once.
**Impact**: UI lag on lower-powered devices; potential memory issues.
**Fix**: Implement virtual scrolling (react-window or TanStack Virtual) for large tables/lists.

### 6. Hardcoded Fuzzy Matching for Caller Import
**Location**: `scripts/import-data.ts` (lines 88-91)
**Problem**: User lookup for "Dani"/"Ico" uses hardcoded substring matching (`includes('dani')`, `includes('ico')`).
**Impact**: Fragile—won't work if usernames change or for new callers.
**Fix**: Create a mapping configuration file or database table for preferred caller aliases.

### 7. Backup Scheduler Reliability
**Location**: `src/lib/scheduler.ts`
**Problem**: Uses `setTimeout` + `setInterval` in Node.js process. In serverless/edge deployments or if the server restarts, scheduled backups may be missed. No persistence of backup state.
**Impact**: Daily backups may not run consistently; no alerting if backup fails.
**Fix**: Use a proper cron scheduler (node-cron) or external scheduling service; add health checks; consider external backup solutions (S3, etc.).

### ~~8. JWT Secret in Production~~ ✅ FIXED
**Location**: `src/lib/auth.ts`
**Status**: Fixed in commit `e501d9d`
**Solution**: Added production check that throws error if `JWT_SECRET` env var is not set.

---

## 🟡 Low Priority / UX Improvements

### ~~9. No Delete Functionality for Dentists~~ ✅ FIXED
**Location**: `src/app/api/dentists/[id]/route.ts`, `src/components/DentistManager.tsx`
**Status**: Fixed in commit `eb05652`
**Solution**: Added DELETE endpoint with safety checks (prevents deletion if dentist has call history) and UI button with confirmation.

### 10. No Bulk Operations
**Location**: Admin Dashboard
**Problem**: No way to bulk-update dentists (e.g., reassign preferred caller for a region).
**Impact**: Tedious manual updates for large-scale changes.
**Fix**: Add bulk selection and batch operation APIs.

### 11. Session Expiry UX
**Location**: Client-side throughout
**Problem**: 7-day JWT expiration without refresh tokens. Users may get logged out mid-work.
**Impact**: Lost work if forms aren't saved before session expires.
**Fix**: Implement refresh token rotation or sliding session expiration.

### 12. CORS Configuration Too Permissive
**Location**: `next.config.ts` (line 11)
**Problem**: `Access-Control-Allow-Origin: *` in production allows any origin.
**Impact**: API could be called from malicious sites.
**Fix**: Restrict to actual frontend domain(s) in production.

### 13. No Rate Limiting
**Location**: All API routes
**Problem**: No protection against brute force login attempts or API abuse.
**Impact**: Security vulnerability.
**Fix**: Add rate limiting middleware (e.g., upstash/ratelimit for serverless).

### 14. Console Logging in Production
**Location**: Multiple API routes
**Problem**: Extensive `console.log` statements for debugging remaining in production code.
**Impact**: Log noise; potential info disclosure.
**Fix**: Use proper logging library with log levels; strip debug logs in production build.

---

## 📋 Data Quality Notes

- **Missing Translations**: Some UI strings (e.g., "Preferred", "Manager:", "Cancel") are hardcoded in English in `caller/page.tsx`.
- **Cities Parsing**: Multiple code paths handle `cities_served` as JSON array, semicolon-separated string, or plain string. Needs standardization.
- **Date Handling**: Mix of local dates and UTC. Server uses SQLite `datetime('now')` (UTC), but UI displays may assume local time.
