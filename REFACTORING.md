# Architecture & Refactoring Analysis

A comprehensive technical review of the DentCall codebase with actionable refactoring suggestions.

---

## 📊 Current Architecture Overview

```mermaid
graph TD
    subgraph Frontend
        LP[Login Page]
        AD[Admin Dashboard]
        CD[Caller Dashboard]
        SC[SchedulePlanner]
        SD[StatsDashboard]
        DM[DentistManager]
    end
    
    subgraph API_Layer[API Routes]
        AUTH[/api/auth/*]
        USERS[/api/users/*]
        DENTISTS[/api/dentists/*]
        CALLS[/api/calls/*]
        ASSIGNMENTS[/api/assignments]
        STATS[/api/stats/*]
        EXPORT[/api/export]
        BACKUP[/api/admin/backup]
    end
    
    subgraph Core_Lib[Core Libraries]
        DB[db.ts - Database]
        AUTHLIB[auth.ts - JWT/Session]
        BACKUPLIB[backup.ts]
        SCHEDULER[scheduler.ts]
        I18N[translations.tsx]
    end
    
    subgraph Data_Layer[Data Layer]
        SQLITE[(SQLite DB)]
        BACKUPDIR[/data/backups/]
    end
    
    LP --> AUTH
    AD --> USERS & DENTISTS & ASSIGNMENTS & STATS & EXPORT & BACKUP
    CD --> ASSIGNMENTS & CALLS & DENTISTS
    SC --> ASSIGNMENTS & STATS
    SD --> STATS
    DM --> DENTISTS & USERS & BACKUP
    
    AUTH & USERS & DENTISTS & CALLS & ASSIGNMENTS & STATS --> DB
    BACKUP --> BACKUPLIB --> BACKUPDIR
    DB --> SQLITE
    SCHEDULER --> BACKUPLIB
```

---

## 🔧 Recommended Refactors

### 1. **Centralize Authentication with Middleware**

**Current State**: Every API route calls `getSession()` and handles auth individually.

**Problem**: 
- Code duplication (~15 routes with identical auth checks)
- Risk of missing auth on new routes
- Inconsistent error responses

**Proposed Solution**:
```typescript
// middleware.ts (new file)
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/session'];
const ADMIN_ROUTES = ['/api/admin', '/api/users', '/api/campaigns'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip public routes
  if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  // Check admin routes
  if (ADMIN_ROUTES.some(route => path.startsWith(route)) && payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Add user info to headers for API routes
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId);
  response.headers.set('x-user-role', payload.role);
  return response;
}

export const config = {
  matcher: '/api/:path*'
};
```

**Effort**: 4-6 hours
**Impact**: High - Reduces code, improves security

---

### 2. **Extract Business Logic from API Routes**

**Current State**: API routes contain both HTTP handling and business logic.

**Problem**:
- Hard to unit test business logic
- Logic duplication between routes
- Long, complex route handlers (assignments route is 529 lines)

**Proposed Solution**: Create service layer

```
src/
├── services/
│   ├── assignment.service.ts
│   ├── dentist.service.ts
│   ├── call.service.ts
│   └── stats.service.ts
├── lib/
│   └── db.ts (existing)
└── app/api/ (thin HTTP layer only)
```

Example refactor for assignments:
```typescript
// services/assignment.service.ts
export class AssignmentService {
  static generateSchedule(params: ScheduleParams): ScheduleResult {
    // All business logic here
  }
  
  static getAssignmentsForDate(date: string, userId?: string): Assignment[] {
    // Query logic here
  }
  
  static deleteAssignments(params: DeleteParams): number {
    // Deletion logic here
  }
}

// app/api/assignments/route.ts (simplified)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const params = await request.json();
  const result = AssignmentService.generateSchedule(params);
  return NextResponse.json(result);
}
```

**Effort**: 8-12 hours
**Impact**: High - Better testability, reusability

---

### 3. **Standardize API Response Format**

**Current State**: Mixed response formats across endpoints.

**Problem**:
- Inconsistent client-side error handling
- No standard pagination format
- Varying success response structures

**Proposed Solution**: Create response utilities

```typescript
// lib/api-response.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta']): NextResponse {
  return NextResponse.json({ success: true, data, meta });
}

export function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function paginatedResponse<T>(
  items: T[], 
  page: number, 
  limit: number, 
  total: number
): NextResponse {
  return NextResponse.json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
```

**Effort**: 3-4 hours
**Impact**: Medium - Better DX, consistent client handling

---

### 4. **Add Request Validation with Zod**

**Current State**: Manual validation in routes with basic checks.

**Problem**:
- Incomplete validation
- No type inference from validation
- Verbose validation code

**Proposed Solution**:
```typescript
// lib/validation/assignment.schema.ts
import { z } from 'zod';

export const generateScheduleSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(30).default(7),
  regions: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  append: z.boolean().default(false),
  caller_ids: z.array(z.string()).optional(),
  campaign_name: z.string().max(100).optional(),
});

export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;

// Usage in route
const parsed = generateScheduleSchema.safeParse(body);
if (!parsed.success) {
  return errorResponse(parsed.error.issues[0].message, 400);
}
const { start_date, days, regions } = parsed.data;
```

**Effort**: 6-8 hours
**Impact**: Medium - Better validation, type safety

---

### 5. **Component Decomposition**

**Current State**: Large monolithic components.

| Component | Lines | Recommendation |
|-----------|-------|----------------|
| `admin/page.tsx` | 1,218 | Split into 6-8 smaller components |
| `SchedulePlanner.tsx` | 799 | Extract region list, city list, config panel |
| `StatsDashboard.tsx` | 475 | Extract each card as separate component |
| `caller/page.tsx` | 501 | Extract assignment card, stats bar |

**Proposed Structure**:
```
components/
├── admin/
│   ├── CalendarView.tsx
│   ├── UserManagement.tsx
│   ├── DataExport.tsx
│   └── DayDetailsModal.tsx
├── schedule-planner/
│   ├── RegionList.tsx
│   ├── CityFilter.tsx
│   ├── ConfigPanel.tsx
│   └── PreviewSummary.tsx
├── caller/
│   ├── AssignmentCard.tsx
│   ├── OutcomeButtons.tsx
│   └── StatsBar.tsx
└── shared/
    ├── DataTable.tsx
    ├── Pagination.tsx
    └── ConfirmModal.tsx
```

**Effort**: 10-15 hours
**Impact**: Medium - Better maintainability, reusability

---

### 6. **Type Safety Improvements**

**Current State**: Some `any` types and missing interfaces.

**Issues Found**:
- `context.params` type assertions
- Inconsistent interface definitions (duplicated User, Dentist types)
- SQL query results untyped

**Proposed Solution**:
```typescript
// types/models.ts (single source of truth)
export interface User {
  id: string;
  username: string;
  password: string;
  role: 'ADMIN' | 'CALLER';
  daily_target: number;
  must_reset_password: number;
  created_at: string;
}

export interface Dentist {
  id: string;
  facility_name: string;
  region: string;
  manager: string | null;
  phones: string; // JSON string
  services: string | null;
  cities_served: string | null;
  locations: string | null;
  staff: string | null;
  staff_count: number | null;
  preferred_caller_id: string | null;
  created_at: string;
}

// Re-export from db.ts or import in db.ts
```

**Effort**: 4-6 hours
**Impact**: Medium - Better IDE support, fewer runtime errors

---

### 7. **Database Query Optimization**

**Current State**: Several N+1 query patterns and unoptimized queries.

**Issues Found**:

1. **Assignments GET**: Fetches assignments, then loops to parse JSON
2. **Stats Dashboard**: Multiple separate queries that could be combined
3. **Missing Indexes**: Some common filters lack indexes

**Proposed Optimizations**:

```sql
-- Add compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assignments_date_caller ON assignments(date, caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_dentist_date ON calls(dentist_id, called_at);
CREATE INDEX IF NOT EXISTS idx_dentists_region_city ON dentists(region, cities_served);
```

Consider using views for complex stats:
```sql
CREATE VIEW IF NOT EXISTS dentist_call_summary AS
SELECT 
  d.id,
  d.region,
  d.facility_name,
  COUNT(c.id) as call_count,
  MAX(c.called_at) as last_called,
  MAX(CASE WHEN c.outcome = 'INTERESTED' THEN 1 ELSE 0 END) as is_interested
FROM dentists d
LEFT JOIN calls c ON d.id = c.dentist_id
GROUP BY d.id;
```

**Effort**: 4-6 hours
**Impact**: High for large datasets

---

### 8. **Translation System Enhancement**

**Current State**: Inline translations in single file, growing to 682 lines.

**Issues Found**:
- Hardcoded English strings scattered in components
- No translation key validation
- Large single file getting unwieldy

**Proposed Solution**:
```
lib/
├── i18n/
│   ├── en/
│   │   ├── common.json
│   │   ├── admin.json
│   │   ├── caller.json
│   │   └── schedule.json
│   ├── bg/
│   │   └── (same structure)
│   ├── types.ts
│   └── provider.tsx
```

Or integrate proper i18n library (next-intl, react-i18next).

**Effort**: 6-8 hours
**Impact**: Low - Maintenance improvement

---

## 📁 File Cleanup Recommendations

### Files to Remove (already gitignored but present):
- `*.py` scripts in root (should be in `scripts/` or removed)
- `*.csv` and `*.json` data files in root
- `dentcall.db` (should be in `data/`)

### Files to Move:
| Current | Proposed | Reason |
|---------|----------|--------|
| Root `*.py` files | `scripts/` | Consistency |
| `dentists*.json` | `data/import/` | Data organization |
| `klienti_*.csv` | `data/import/` | Data organization |

### Suggested `.gitignore` additions:
```
# Already covered, but ensure:
/data/import/
*.sql
*.sqlite
```

---

## 🚀 Quick Wins (Can Do Today)

1. **Fix schema mismatch** - Remove `address`/`email` from INSERT or add columns (~30 min)
2. **Add missing indexes** - Run SQL above (~15 min)
3. **Standardize cities_served format** - Choose JSON array, update import (~2 hours)
4. **Remove console.logs** - Search and remove debug logging (~1 hour)
5. **Add JWT_SECRET check** - Throw on missing in production (~15 min)
6. **Fix hardcoded strings** - Replace remaining English strings with `t()` (~2 hours)

---

## 📈 Technical Debt Summary

| Category | Items | Priority |
|----------|-------|----------|
| Security | 4 | 🔴 High |
| Data Quality | 3 | 🟠 Medium |
| Code Quality | 6 | 🟡 Low-Medium |
| Performance | 3 | 🟠 Medium |
| DX/Maintainability | 5 | 🟢 Low |

**Total Estimated Refactoring Time**: 60-80 hours for all items
**Recommended First Sprint**: Items 1, 3, 4, 7 (Quick Wins + Auth Middleware) = ~12 hours
