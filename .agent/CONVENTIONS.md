# Coding Conventions

## TypeScript

- Use TypeScript for all files (except Python data scripts)
- Define interfaces for all data structures
- Use `type` for unions, `interface` for objects
- Avoid `any` - use proper types or `unknown`

## React Components

```tsx
// Use 'use client' directive for client components
'use client';

// Imports order: React, Next, external libs, internal (@/...)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/translations';

// Define interfaces above component
interface Props {
    propName: string;
}

// Use default export for page components
export default function ComponentName({ propName }: Props) {
    const { t } = useTranslation();
    // ...
}
```

## API Routes (Next.js App Router)

```typescript
// Location: src/app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// Always check authentication first
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Admin-only routes
    if (session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Database queries with better-sqlite3 (synchronous)
    const results = db.prepare('SELECT * FROM table').all();
    
    return NextResponse.json({ data: results });
}
```

## Database Operations

```typescript
// Import the singleton
import db from '@/lib/db';

// Read operations
const users = db.prepare('SELECT * FROM users').all();
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// Write operations
db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username);
db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
db.prepare('DELETE FROM users WHERE id = ?').run(id);

// Transactions
const insertMany = db.transaction((items) => {
    for (const item of items) {
        db.prepare('INSERT INTO table VALUES (?)').run(item);
    }
});
insertMany(items);
```

## Styling (Tailwind CSS)

- Dark theme with `slate` color palette (slate-900, slate-800, slate-700)
- Accent colors: `emerald` (success/primary), `red` (danger), `purple` (admin), `cyan` (caller)
- Use consistent spacing: `p-4`, `p-6`, `gap-4`, `space-y-4`
- Border radius: `rounded-lg`, `rounded-xl`
- Common patterns:
  ```tsx
  // Card
  <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
  
  // Button (primary)
  <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-medium">
  
  // Button (danger)
  <button className="text-red-400 hover:text-red-300">
  
  // Input
  <input className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" />
  ```

## Translations

```tsx
// Always use the translation hook for user-facing text
const { t } = useTranslation();

// Usage
<h1>{t('admin_title')}</h1>
<button>{t('save')}</button>

// Adding new translations: edit src/lib/translations.tsx
// Add key to both 'en' and 'bg' objects
```

## File Naming

- Components: `PascalCase.tsx` (e.g., `DentistManager.tsx`)
- API routes: `route.ts` in appropriate directory
- Utilities: `kebab-case.ts` (e.g., `api-response.ts`)
- Pages: `page.tsx` in route directory

## Error Handling

```typescript
try {
    // operation
} catch (error) {
    console.error('Descriptive message:', error);
    return NextResponse.json(
        { error: 'User-friendly message' },
        { status: 500 }
    );
}
```
