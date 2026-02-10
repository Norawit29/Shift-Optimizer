# Hospital Shift Scheduler

## Overview

This is a **Hospital Shift Scheduler** web application that automates duty roster creation for hospital staff. It uses a constraint-based optimization algorithm to generate fair shift schedules, handling staff availability, consecutive shift rules, and workload balancing. The app follows a wizard-based workflow where users configure schedule parameters, add staff, set blocked dates, run the optimizer, and save/review results.

Key features:
- **Schedule Comparison**: The optimizer generates 3 variations per run, sorted by fairness. Users compare them side-by-side and pick the best one to save.
- **Duplicate from Previous Schedule**: In Step 1, users can load staff list and shift configuration from a previously saved schedule (blocked dates are cleared).
- **Circadian Rhythm Optimization**: Soft preferences for consecutive same-shift grouping and forward rotation (Morning→Evening→Night).
- **Auto-retry**: 30 attempts before reporting failure, handles edge cases from random ordering.
- **Excel Export**: Two-sheet export with schedule and summary data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure

The project uses a **monorepo layout** with three top-level directories:

- **`client/`** — React SPA (Single Page Application)
- **`server/`** — Express.js REST API backend
- **`shared/`** — Shared types, schemas, and route definitions used by both client and server

### Frontend (`client/`)

- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; local React state for wizard flow
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (medical blue/teal palette)
- **Animations**: Framer Motion for wizard step transitions
- **Charts**: Recharts for workload distribution visualization
- **Date Utilities**: date-fns
- **Build Tool**: Vite

Key pages:
- `HomePage` — Landing page with navigation to create or view history
- `WizardPage` — Multi-step form wizard for schedule creation (config → staff → blocked dates → optimize → save)
- `HistoryPage` — Lists all saved schedules
- `ScheduleDetailsPage` — View a specific saved schedule with table and stats

The shift optimization algorithm runs **client-side** in `client/src/lib/optimizer.ts`. It's a deterministic constraint-based solver (not AI/ML), filling shifts greedily while respecting hard constraints (blocked dates, consecutive shift rules, max shifts per person) and then doing local repair for fairness.

### Backend (`server/`)

- **Framework**: Express.js v5 on Node.js
- **Language**: TypeScript, compiled with tsx (dev) and esbuild (production)
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Route Definitions**: Shared route contract in `shared/routes.ts` with Zod schemas for input validation and response typing

API endpoints:
- `GET /api/schedules` — List all schedules
- `GET /api/schedules/:id` — Get a single schedule
- `POST /api/schedules` — Create a schedule
- `PUT /api/schedules/:id` — Update a schedule
- `DELETE /api/schedules/:id` — Delete a schedule

### Data Storage

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-Zod conversion
- **Schema Strategy**: Document-store approach — the `schedules` table stores complex nested data (config, staff list, optimization results) as JSONB columns rather than normalized tables. This simplifies the schema for the complex nested structures involved.
- **Migration**: `drizzle-kit push` for schema synchronization (no migration files needed during development)
- **Connection**: `DATABASE_URL` environment variable required; uses `pg` Pool

The single `schedules` table contains:
- `id` — Auto-incrementing primary key
- `name` — Schedule name
- `month`, `year` — Target period
- `config` (JSONB) — Shift configuration (shift names, staff per shift, consecutive rules)
- `staff` (JSONB) — Array of staff members with blocked dates
- `result` (JSONB) — Generated schedule matrix
- `isPublished` — Boolean flag
- `createdAt`, `updatedAt` — Timestamps

### Shared Code (`shared/`)

- `schema.ts` — Drizzle table definitions and Zod insert schemas, plus TypeScript types
- `routes.ts` — API route contract with paths, methods, Zod input/output schemas

This shared layer ensures type safety across the full stack.

### Build & Dev

- **Dev**: `tsx server/index.ts` starts Express, which sets up Vite dev server as middleware for HMR
- **Production Build**: Vite builds the client to `dist/public/`, esbuild bundles the server to `dist/index.cjs`
- **Replit Integration**: Uses `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, and `@replit/vite-plugin-dev-banner` in development

### Design Decisions

1. **Client-side optimization**: The shift scheduling algorithm runs in the browser. This avoids server load for computation and gives instant feedback. The server just stores results.

2. **JSONB document store**: Instead of normalizing staff, shifts, and schedules into many relational tables, the complex nested structures are stored as JSONB. This trades query flexibility for simplicity, which is appropriate since the app always loads/saves entire schedule documents.

3. **Shared route contracts**: Using `shared/routes.ts` with Zod schemas ensures the frontend and backend agree on API shapes at compile time, reducing integration bugs.

4. **shadcn/ui components**: Pre-built, customizable components copied into the project (not installed as a dependency). They live in `client/src/components/ui/` and can be freely modified.

## External Dependencies

### Required Services

- **PostgreSQL Database**: Required. Connection via `DATABASE_URL` environment variable. Used by Drizzle ORM for all data persistence.

### Key NPM Packages

- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** v5 — HTTP server
- **@tanstack/react-query** — Client-side data fetching and caching
- **zod** + **drizzle-zod** — Schema validation shared between client and server
- **framer-motion** — Page transition animations
- **recharts** — Charts for workload statistics
- **wouter** — Client-side routing
- **nanoid** — Unique ID generation for staff members
- **Radix UI** (multiple packages) — Accessible UI primitives for shadcn/ui components
- **date-fns** — Date manipulation for calendar/schedule generation

### Fonts (External)

- Google Fonts: DM Sans, Outfit, Fira Code (loaded via CSS import and HTML link tags)