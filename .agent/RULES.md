# Agent Rules

Guidelines for AI agents working on this codebase.

## Critical Rules

### 1. Update Documentation

**Always update `.agent/` documentation when making changes that affect:**
- Database schema (columns, tables, migrations)
- API endpoints (new, modified, or removed)
- Business logic (scheduling, call outcomes, virtual regions)
- UI conventions (new patterns, components)
- Translation keys

**Files to update:**
- `PROJECT.md` - Structure, schema, tech stack changes
- `CONVENTIONS.md` - New coding patterns
- `CODEFLOWS.md` - Changed business logic
- `API.md` - Endpoint changes
- `FEATURES.md` - Custom feature changes

### 2. Translation System

**Every user-facing string must use translations:**
```tsx
const { t } = useTranslation();
<h1>{t('key_name')}</h1>
```

**When adding UI text:**
1. Add key to both `en` and `bg` objects in `src/lib/translations.tsx`
2. Use descriptive, snake_case keys
3. Never hardcode Bulgarian or English text directly

### 3. Display Name Priority

**Always use `display_name` with fallback to `username`:**
```tsx
// Frontend
{user.display_name || user.username}

// SQL
COALESCE(u.display_name, u.username) AS caller_name
```

### 4. Database Migrations

**When adding columns:**
```typescript
// In src/lib/db.ts, after table creation
const columns = db.pragma('table_info(tablename)') as { name: string }[];
const hasColumn = columns.some(col => col.name === 'new_column');
if (!hasColumn) {
    db.exec(`ALTER TABLE tablename ADD COLUMN new_column TYPE`);
    // Backfill if needed
    db.exec(`UPDATE tablename SET new_column = default WHERE ...`);
    logger.migration('Added new_column to tablename');
}
```

### 5. Admin-Only Endpoints

**Always check role for sensitive operations:**
```typescript
if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Note: Middleware handles basic auth at the edge, but route handlers still verify session for user data.

### 6. Virtual Regions Awareness

**When modifying schedule-related code, remember:**
- Virtual regions (`★ Клиенти X`, `🦷 Импланти`) are not real database values
- They're parsed from region names with specific prefixes
- Must handle them separately in filtering logic

### 7. Preferred Caller Logic

**When working with dentist assignments:**
- Dentists with `preferred_caller_id` belong to that caller exclusively
- They're excluded from geographic region counts
- Virtual regions show them separately

### 8. Terminal Outcomes

**These outcomes remove dentists from future scheduling:**
- `INTERESTED`
- `NOT_INTERESTED`
- `ORDER_TAKEN`

Non-terminal outcomes (`NO_ANSWER`, `CALLBACK`) allow re-scheduling after exclude days.

### 9. Build Verification

**After making code changes:**
1. Run `npm run build` to verify no TypeScript errors
2. Check for lint warnings
3. Test affected functionality

### 10. Problems Panel Check

**Before saying work is finished:**
- Check the VS Code Problems panel and resolve any remaining errors
- If any errors remain, call them out explicitly

### 11. Interface Consistency

**Keep interface definitions in sync:**
- Same User/Caller interface across components
- Include `display_name?: string | null` in all user-related interfaces
- Match API response shapes
- Types exported from `src/lib/db.ts`

### 12. Commit Hygiene

**Avoid committing:**
- Database files (`*.db`, `*.db-wal`, `*.db-shm`)
- JSON data files (`dentists.json`, etc.)
- Python scripts (data processing)
- `.env` files

### 13. Use Zod Validation

**For new API endpoints, always:**
1. Create a Zod schema in `src/lib/validation.ts`
2. Use `validateBody()` or `validateQuery()` helpers
3. Return structured validation errors

### 14. API Response Format

**Use standardized responses from `src/lib/api-response.ts`:**
- `successResponse(data)` for successful operations
- `errorResponse(message, statusCode)` for errors
- `paginatedResponse(items, page, limit, total)` for lists

## Quick Reference

### Common Files to Check:
- `src/lib/db.ts` - Database schema & types
- `src/lib/translations.tsx` - All UI text
- `src/lib/validation.ts` - Zod schemas
- `src/app/api/*/route.ts` - API endpoints
- `src/components/*` - Reusable UI
- `src/middleware.ts` - Auth middleware

### Common Patterns:
```typescript
// Session check
const session = await getSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// DB query with prepared statement
const result = db.prepare('SELECT * FROM table WHERE id = ?').get(id);

// Translation usage
const { t } = useTranslation();

// Zod validation
const validation = await validateBody(request, schema);
if (!validation.success) return validation.response;
```

### Git Commit Messages

**Use conventional commit format** matching the existing project history:

- `fix:` or `fix(scope):` for bug fixes
- `feat:` or `feat(scope):` for new features
- `refactor:` for code restructuring
- Scope examples: `ui`, `api`, `caller`, `admin`, `db`

**Examples from this project:**
```
fix: schedule generator excludes ORDER_TAKEN terminal outcomes
feat(caller): show last order date on dentist cards
fix(api): scope calls endpoint by caller_id for non-admins
feat: daily summaries and implants reporting
```
