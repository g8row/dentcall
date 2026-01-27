# API Reference

## Authentication (`/api/auth/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | None | Login with username/password |
| `/api/auth/logout` | POST | Any | Clear session cookie |
| `/api/auth/session` | GET | Any | Get current session info |
| `/api/auth/reset-password` | POST | Any | Reset password (after login with must_reset_password) |

## Users (`/api/users/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/users` | GET | Admin | List all users |
| `/api/users` | POST | Admin | Create user. Body: `{username, password, display_name?, role?, daily_target?}` |
| `/api/users/[id]` | PATCH | Admin | Update user. Body: `{username?, display_name?, password?, role?, daily_target?}` |
| `/api/users/[id]` | DELETE | Admin | Delete user (cannot delete self) |

## Dentists (`/api/dentists/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/dentists` | GET | Any | List dentists. Query: `page, limit, search, region, city` |
| `/api/dentists` | POST | Admin | Create dentist |
| `/api/dentists/[id]` | GET | Any | Get single dentist with call history |
| `/api/dentists/[id]` | PATCH | Admin | Update dentist |
| `/api/dentists/[id]` | DELETE | Admin | Delete dentist |
| `/api/dentists/import` | POST | Admin | Import dentists from JSON |
| `/api/dentists/regions` | GET | Any | Get unique regions |
| `/api/dentists/locations` | GET | Any | Get cities for regions. Query: `regions` |

## Calls (`/api/calls/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/calls` | GET | Any | List calls. Query: `dentist_id?, caller_id?, date?` |
| `/api/calls` | POST | Any | Log call. Body: `{dentist_id, outcome, notes?}` |
| `/api/calls/[id]` | PATCH | Any | Update call outcome/notes |

## Assignments (`/api/assignments/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/assignments` | GET | Any | Get assignments. Query: `date?, caller_id?, start_date?, end_date?` |
| `/api/assignments` | POST | Admin | Generate schedule. Body: `{start_date, days, regions?, cities?, callerIds?, excludeDays?, appendMode?}` |
| `/api/assignments` | DELETE | Admin | Delete schedule. Query: `date` |

## Campaigns (`/api/campaigns/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/campaigns` | GET | Admin | List all campaigns with stats |
| `/api/campaigns` | POST | Admin | Create campaign |
| `/api/campaigns/[id]` | PATCH | Admin | Update campaign status |
| `/api/campaigns/[id]` | DELETE | Admin | Delete campaign |

## Statistics (`/api/stats/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/stats/dashboard` | GET | Any | Overall dashboard stats |
| `/api/stats/outcomes` | GET | Any | Outcome distribution |
| `/api/stats/regions` | GET | Any | Stats by region |
| `/api/stats/schedule-planner` | GET | Admin | Preview data for scheduler |

## Data Management (`/api/data/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/data` | DELETE | Admin | Delete history. Query: `type=calls|assignments|all` |

## Export (`/api/export/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/export` | GET | Admin | Export data. Query: `type=dentists|calls|stats&startDate?&endDate?` |

## Admin (`/api/admin/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/backup` | POST | Admin | Create database backup. Query: `mode=server?` |

## Common Response Patterns

```typescript
// Success
{ success: true, data: {...} }
{ users: [...] }
{ dentists: [...], pagination: { page, totalPages, total } }

// Error
{ error: "Error message" }  // with status code 400/401/403/500
```
