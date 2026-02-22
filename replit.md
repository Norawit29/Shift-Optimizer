# Hospital Shift Scheduler

## Overview

This is a **Hospital Shift Scheduler** web application that automates duty roster creation for hospital staff. It uses a constraint-based optimization algorithm to generate fair shift schedules, handling staff availability, consecutive shift rules, workload balancing, and optional weekend/holiday shift balancing. The app follows a wizard-based workflow where users configure schedule parameters, add staff, set blocked dates, configure constraints (including holiday balancing), run the optimizer, and save/review results.

The scheduler supports two timeline modes:
- **Full Month**: Traditional month/year selection for a complete calendar month
- **Custom Range**: Arbitrary start and end dates (e.g., March 8 - April 4, 2026) for scheduling across month boundaries. Custom range info is stored in the `SchedulerConfig` JSONB (`useCustomRange`, `customStartDate`, `customEndDate`) to avoid DB schema changes. Day indices are 1-based sequential and mapped to actual dates via `addDays(startDate, index - 1)`. Switching modes clears blocked dates and holidays to prevent misapplication.

The scheduler supports **separate weekend/holiday staffing**:
- Toggle `separateHolidayConfig` to set different staff-per-shift for weekends/holidays vs weekdays
- `holidayStaffPerShift` array parallels `staffPerShift` — same shift names, different counts
- Setting a shift's holiday staff to 0 effectively disables that shift on weekends/holidays
- The optimizer, schedule view, and Excel export all respect per-day staffing requirements

The scheduler supports **consecutive shift rules** with two types:
- **Next-day rules** (`type: 'nextDay'`): Prevent shift A on day D followed by shift B on day D+1 (e.g., Night→Morning)
- **Same-day rules** (`type: 'sameDay'`): Prevent two overlapping shifts on the same day (e.g., 9-22 with Morning)
- Each rule has `from`, `to` (shift indices) and optional `type` (defaults to 'nextDay' for backward compatibility)
- Same-day rules are symmetric in the LP constraint (`x_from + x_to <= 1`)

The scheduler supports **requested/preferred shifts**:
- Each StaffMember has optional `requested` array (same format as `blocked`: `{date, shift}[]`)
- Requested shifts are enforced as HARD constraints in the optimizer (`x[i,d,s] = 1`)
- UI has mode toggle: "Block mode" (red) and "Request mode" (green)
- In request mode, clicking a calendar date adds all non-blocked shifts as requested
- Blocked and requested are mutually exclusive — blocking a date/shift auto-removes any requests
- Excel export shows green borders for cells with fulfilled requested shifts

The scheduler supports **staff levels** (up to 5 levels):
- `staffLevels` in SchedulerConfig: array of level names (e.g., ["พยาบาล", "ผู้ช่วยพยาบาล", "คนงาน"])
- Each StaffMember has an optional `level` field (0-based index into staffLevels)
- `minStaffPerLevel` in SchedulerConfig: 2D array `[shiftIdx][levelIdx]` for minimum staff of each level per shift
- The optimizer enforces level minimums as hard constraints (LP `>= minRequired`)
- Greedy post-processing prioritizes candidates that help meet unmet level requirements
- Schedule view and Excel export display staff levels when configured
- Feature is fully optional — backward compatible when `staffLevels` is undefined

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
- `HomePage` — Landing page with single "Create Schedule" button
- `WizardPage` — Multi-step form wizard for schedule creation (config → staff → blocked dates → optimize → export). Always runs in export-only mode — generates Excel output directly, no database saving.

The shift optimization algorithm runs **client-side** in `client/src/lib/optimizer.ts` using **Mixed Integer Programming (MIP)** via the HiGHS solver (WASM). The optimizer uses a **2-phase approach**:
- **Phase 1**: Maximizes total coverage (`Σ x[i,d,s]`) subject to hard constraints (blocked dates, one-shift-per-day, consecutive rules, max shifts, staffing caps). Produces optimal coverage value `C*`.
- **Phase 2**: Minimizes fairness deviations subject to all Phase 1 constraints plus a coverage floor (`Σ x >= C*`). Uses **deviation variables** (`dev >= |actual - avg|`) for workload balance, per-shift-type balance, and holiday balance. Targets are computed from Phase 1 actual results, not theoretical maximums. Falls back to Phase 1 result if Phase 2 fails.

This 2-phase design ensures coverage is never sacrificed for fairness. The WASM file is served from `client/public/highs.wasm`. Time limit: 15 seconds per phase, MIP gap: 1%.

**Constraint priority:**
- HARD: Consecutive shift rules (e.g., Night→Morning blocked) — never violated
- HARD: Staff per shift count — exact staffing requirements
- SOFT: Fairness (min-max workload difference) — optimizer prefers equal distribution but will give some staff more shifts to maximize coverage

After the MIP solver, a **greedy post-processing** (up to 3 passes) fills any remaining unfilled slots by assigning available staff (lowest workload first) while respecting ALL hard constraints. Phase 2 has per-slot and global coverage floor constraints matching Phase 1's optimal. If slots remain unfilled after greedy fill, diagnostic logging shows WHY each slot can't be filled (consecutive rule, maxShifts, blocked dates, etc.).

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

Analytics tables:
- `usage_logs` — Tracks events like schedule generation with metadata (staff count, day count, shift count, coverage %, duration, etc.)
- `generated_schedules` — Stores anonymized copies of generated schedules (config, anonymized staff, optimizer result) for analytics. Staff names are anonymized client-side before sending.

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