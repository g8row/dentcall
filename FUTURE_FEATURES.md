# Future Features

This document outlines planned features, their implementation approach, and priority.

---

## ✅ Completed

- [x] **UI for Preferred Callers**: Specific Admin UI to view and manage preferred caller assignments manually.
- [x] **Scheduler Enhancements**: Show detailed breakdown of preferred dentists per caller in the Planner UI.
- [x] **Global Add Dentist Action**: Make the "Add Dentist" button actionable from the main navigation or dashboard.
- [x] **Database Management Tab**: View/Edit raw dentist records and manage `preferred_caller_id` directly.
- [x] **Periodic Backups**: Automated daily database backup system with rotation (keeps last 30).

---

## 🔥 High Priority

### 1. CSV Upload for Preferred Caller Updates
**Status**: Not started
**Description**: Allow admin to upload new client CSVs to update preferences on the fly without code changes.
**Implementation Plan**:
1. Create `/api/admin/import-preferences` POST endpoint
2. Parse uploaded CSV, normalize phone numbers
3. Match to existing dentists by phone
4. Update `preferred_caller_id` accordingly
5. Return summary (matched, updated, not found)
6. Add UI button in DentistManager with file picker

**Estimated Effort**: 4-6 hours

---

### 2. Caller Stats by Preference Type
**Status**: Not started
**Description**: Track and display success rates for "preferred" dentists vs. random common pool dentists.
**Implementation Plan**:
1. Add `is_preferred_assignment` boolean to assignments table (migration)
2. Modify schedule generation to set this flag
3. Update `/api/stats/dashboard` to compute separate metrics:
   - Preferred: interested rate, callback rate
   - Common: interested rate, callback rate
4. Add comparison charts to StatsDashboard

**Estimated Effort**: 6-8 hours

---

### 3. Dynamic Preferred Caller Rules
**Status**: Not started
**Description**: Allow defining preferred caller rules (by region, by city, by phone prefix) in the UI instead of CSV/code.
**Implementation Plan**:
1. Create `preference_rules` table:
   ```sql
   CREATE TABLE preference_rules (
     id TEXT PRIMARY KEY,
     rule_type TEXT NOT NULL, -- 'region' | 'city' | 'phone_prefix'
     rule_value TEXT NOT NULL,
     caller_id TEXT NOT NULL,
     priority INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (caller_id) REFERENCES users(id)
   );
   ```
2. Create CRUD API endpoints
3. Update assignment generation to apply rules
4. Build Rules Manager UI component

**Estimated Effort**: 10-12 hours

---

## 🟠 Medium Priority

### 4. Mobile App / PWA
**Status**: Investigation
**Description**: Make the caller interface work offline and installable on mobile devices.
**Implementation Plan**:
1. Add PWA manifest (`public/manifest.json`)
2. Configure service worker for offline caching
3. Cache assignment data locally for offline viewing
4. Sync outcomes when back online

**Estimated Effort**: 8-12 hours

---

### 5. Call Recording Notes Enhancement
**Status**: Not started
**Description**: Rich notes with structured fields (callback date, contact person, preferred time).
**Implementation Plan**:
1. Add `callback_date` and `contact_name` columns to calls table
2. Update call logging UI with optional fields
3. Add smart filtering for callbacks due today/this week
4. Calendar integration for callback reminders

**Estimated Effort**: 6-8 hours

---

### 6. Bulk Import/Update Dentists
**Status**: Not started
**Description**: Upload Excel/CSV to bulk add or update dentist records.
**Implementation Plan**:
1. Create import preview UI showing changes
2. Handle duplicates with merge strategy options
3. Support partial updates (only non-empty fields)
4. Transaction-based import with rollback on error

**Estimated Effort**: 8-10 hours

---

### 7. Email/SMS Notifications
**Status**: Future consideration
**Description**: Notify admin of daily summaries, alert callers of priority callbacks.
**Implementation Plan**:
1. Integrate with email provider (SendGrid, Resend)
2. Daily digest cron job
3. Callback reminder notifications
4. Low activity alerts

**Estimated Effort**: 10-15 hours

---

### 8. Multi-Tenant Support
**Status**: Future consideration
**Description**: Support multiple companies/teams with isolated data.
**Implementation Plan**:
1. Add `tenant_id` to all tables
2. Modify all queries to filter by tenant
3. Tenant management UI
4. Separate login flows per tenant

**Estimated Effort**: 20-30 hours

---

## 🟢 Nice to Have

### 9. Dark/Light Theme Toggle
**Status**: Not started
**Description**: Currently dark-only. Add light theme option.
**Implementation Plan**:
1. Define CSS variables for theme colors
2. Add theme context provider
3. Toggle switch in header
4. Persist preference in localStorage

**Estimated Effort**: 2-3 hours

---

### 10. Advanced Search & Filters
**Status**: Partial
**Description**: Full-text search across notes, advanced date/outcome filters.
**Implementation Plan**:
1. Add SQLite FTS5 extension for notes
2. Build advanced filter UI component
3. Save filter presets per user

**Estimated Effort**: 6-8 hours

---

### 11. Keyboard Shortcuts
**Status**: Not started
**Description**: Power user shortcuts for callers (e.g., 1-5 for outcomes, N for notes).
**Implementation Plan**:
1. Add keyboard event listeners to caller dashboard
2. Show shortcut hints on cards
3. Configurable shortcut mappings

**Estimated Effort**: 3-4 hours

---

### 12. Data Visualization Dashboard
**Status**: Partial (basic charts exist)
**Description**: Interactive charts with drill-down, trend analysis, export to PDF.
**Implementation Plan**:
1. Integrate charting library (Chart.js, Recharts)
2. Add time period selectors
3. Regional heat maps
4. PDF report generation

**Estimated Effort**: 10-15 hours

---

### 13. Activity Audit Log
**Status**: Not started
**Description**: Track all admin actions for compliance/debugging.
**Implementation Plan**:
1. Create `audit_logs` table
2. Log all mutations (user, action, timestamp, before/after)
3. Admin UI to view/filter logs
4. Export capability

**Estimated Effort**: 6-8 hours

---

### 14. Backup Monitoring Dashboard
**Status**: Not started (backups work but no visibility)
**Description**: View backup history, health status, quick restore.
**Implementation Plan**:
1. List backups in `/data/backups/`
2. Show last backup time, file sizes
3. One-click server-side restore (with confirmation)
4. Backup health alerts

**Estimated Effort**: 4-6 hours

---

## 🔧 Technical Improvements

### 15. API Response Standardization
**Description**: Standardize all API error/success responses with consistent structure.

### 16. Request Validation Layer
**Description**: Use Zod schemas for request body validation across all routes.

### 17. Database Connection Pooling
**Description**: While SQLite is single-file, consider connection management for concurrency.

### 18. Automated Testing
**Description**: Add Jest/Vitest tests for API endpoints and critical business logic.

### 19. Error Monitoring
**Description**: Integrate Sentry or similar for production error tracking.

### 20. CI/CD Pipeline
**Description**: GitHub Actions for linting, testing, and Docker builds.
