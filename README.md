# DentCall - Cold Calling Management System

A web application for managing dental clinic cold calling campaigns. Built with Next.js and SQLite.

## Features

### Admin Dashboard
- Statistics overview with KPIs, charts, and region coverage data
- Weekly schedule management with calendar view
- User management for callers
- Campaign tracking across regions
- Data export to Excel (dentists, calls, statistics)

### Caller Interface
- Daily assignment queue
- Call outcome recording (interested, not interested, no answer, callback)
- Notes and follow-up tracking
- Progress tracking against daily targets

### Data Management
- Region and city-based dentist organization
- Call history with full audit trail
- Schedule generation with smart distribution
- Coverage and interest rate analytics

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite with better-sqlite3
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Export**: XLSX for Excel generation

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Default Credentials

- **Admin**: username `admin`, password `admin123`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── admin/           # Admin dashboard pages
│   ├── api/             # API routes
│   ├── caller/          # Caller interface
│   └── page.tsx         # Login page
├── components/          # Reusable UI components
└── lib/                 # Database and utilities

data/
└── cold-caller.db       # SQLite database (created on first run)

scripts/
└── import-dentists.ts   # Data import utilities
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/auth/*` | Authentication (login, logout, session) |
| `/api/users/*` | User management |
| `/api/dentists/*` | Dentist data and locations |
| `/api/assignments` | Schedule management |
| `/api/calls/*` | Call recording |
| `/api/stats/*` | Statistics and analytics |
| `/api/export` | Excel export |
| `/api/campaigns` | Campaign management |

## Localization

The application supports English and Bulgarian. Language can be switched from the header.

## License

Private project.
