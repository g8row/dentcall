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

### 8. Build Verification

**After making code changes:**
1. Run `npm run build` to verify no TypeScript errors
2. Check for lint warnings
3. Test affected functionality

### 9. Interface Consistency

**Keep interface definitions in sync:**
- Same User/Caller interface across components
- Include `display_name?: string | null` in all user-related interfaces
- Match API response shapes

### 10. Commit Hygiene

**Avoid committing:**
- Database files (`*.db`, `*.db-wal`, `*.db-shm`)
- JSON data files (`dentists.json`, etc.)
- Python scripts (data processing)
- `.env` files

## Quick Reference

### Common Files to Check:
- `src/lib/db.ts` - Database schema
- `src/lib/translations.tsx` - All UI text
- `src/app/api/*/route.ts` - API endpoints
- `src/components/*` - Reusable UI

### Common Patterns:
```typescript
// Session check
const session = await getSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// DB query with prepared statement
const result = db.prepare('SELECT * FROM table WHERE id = ?').get(id);

// Translation usage
const { t } = useTranslation();
```
