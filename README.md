# DentCall - Cold Calling Management System

A web application for managing dental clinic cold calling campaigns. Built with Next.js and SQLite.

## Features

### Admin Dashboard
- **Statistics & Analytics**: Real-time KPI cards, Daily Performance Table (calls, interest rate, success rate), and Outcome Distribution charts.
- **Calendar Management**: Interactive Weekly and Monthly views with detailed day breakdowns via modal popups.
- **Schedule Planner**: Advanced assignment generation with region filtering and workload balancing.
- **User Management**: Manage callers and set daily targets.
- **Data Export/Import**: Seamlessly import new dentist data and export reports to Excel.

### Caller Interface
- **Mobile-Optimized**: Responsive design for on-the-go calling.
- **Efficient Workflow**: Streamlined daily assignment queue with quick outcome recording.
- **History & Notes**: Access previous interaction history and add detailed notes.
- **Progress Tracking**: Real-time progress bars against daily targets.

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

### Production Build

```bash
npm run build
npm start
```

### Docker

Build and run with Docker Compose:

```bash
docker compose up -d
```

Or build manually:

```bash
docker build -t dentcall .
docker run -p 3000:3000 -v dentcall-data:/app/data dentcall
```

The SQLite database is stored in a Docker volume for persistence.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes (prod)** | - | Secret key for JWT tokens. **Must be set in production.** Generate with: `openssl rand -base64 32` |
| `CORS_ORIGIN` | No | `*` (dev) | Allowed CORS origin. Set to your frontend domain in production (e.g., `https://app.example.com`) |
| `LOG_LEVEL` | No | `warn` (prod), `debug` (dev) | Logging level: `debug`, `info`, `warn`, `error` |
| `INSECURE_COOKIES` | No | `false` | Set to `true` to disable secure cookies (for local HTTP development) |

### Example `.env` file:

```bash
# Production
JWT_SECRET=your-very-secure-random-string-here
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=warn

# Development (optional)
INSECURE_COOKIES=true
```

## Security Features

- **JWT Authentication** with secure cookie storage
- **Rate Limiting** on login endpoint (5 attempts / 15 minutes per IP)
- **CORS Protection** with configurable origins
- **Role-based Access Control** (Admin / Caller roles)
- **Centralized Auth Middleware** for all API routes

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
