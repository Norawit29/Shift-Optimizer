# Hospital Shift Scheduler

## Overview

The Hospital Shift Scheduler is a web application designed to automate the creation of duty rosters for hospital staff. It employs a constraint-based optimization algorithm to generate fair and efficient shift schedules. The application manages staff availability, consecutive shift rules, workload balancing, and optional weekend/holiday shift balancing. It features a wizard-based user interface for configuring schedule parameters, adding staff, setting blocked dates, defining constraints, running the optimizer, and reviewing/exporting results.

Key capabilities include:
- Support for both full-month and custom date range scheduling.
- Separate staffing configurations for weekends/holidays.
- Comprehensive consecutive shift rules (next-day and same-day prevention).
- Implementation of requested/preferred shifts as hard constraints.
- Rules for maximum consecutive shifts for specific staff groups.
- Support for multiple staff levels with minimum staffing requirements per level, enforced via soft constraints to ensure feasibility.

The project aims to simplify hospital shift management, improve fairness in scheduling, and reduce the administrative burden on managers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure

The project utilizes a monorepo structure comprising three main parts:
- **`client/`**: A React Single Page Application (SPA) for the user interface.
- **`server/`**: An Express.js REST API backend.
- **`shared/`**: Contains common types, schemas, and API route definitions used by both client and server.

### Frontend (`client/`)

- **Technology Stack**: React with TypeScript, Wouter for routing, TanStack React Query for server state management, shadcn/ui for UI components (built on Radix UI), Tailwind CSS for styling, Framer Motion for animations, Recharts for data visualization, and date-fns for date utilities. Vite is used as the build tool.
- **Core Functionality**: The shift optimization algorithm runs client-side within a Web Worker (`solverWorker.ts`) to maintain UI responsiveness. It uses the HiGHS solver (WASM) with a 3-stage Mixed Integer Programming (MIP) pipeline.
    - **Phase 1 (Coverage)**: `buildCoverageModel()` — Maximizes total coverage (minimizes unfilled slots). Includes staffing capacity, maxShifts, shiftsPerDay, consecutiveRules, maxConsecutiveRules, and requested shifts. Excludes level constraints and fairness.
    - **Phase 1.5 (Quality Check)**: If coverage ratio < 20%, skips fairness phase and returns partial result with diagnostics.
    - **Phase 2A (Range)**: `buildRangeModel()` — Locks coverage from Phase 1 (cannot reduce). Minimizes maxLoad - minLoad only. No per-shift balance, holiday balance, or level constraints.
    - **Phase 2B (Distribution)**: `buildDistributionModel()` — Locks range from Phase 2A (`maxLoad - minLoad <= bestRange`). Minimizes per-shift balance (ds_*), holiday balance (dh_*), and soft level slack (lslk_*). Level constraints added as soft only (slack + penalty weight 10). `writeSoftLevelConstraints()` generates the soft level constraint block.
- **Feasibility Checking**: `checkFeasibility()` returns `{ hardErrors, levelErrors, softWarnings }`. Hard errors (all staff blocked, all maxShifts=0) cause immediate abort before solver runs. Level errors auto-downgrade to soft constraints. Soft warnings are passed through to results as diagnostics.
- **Optimization Details**: The optimizer is fully deterministic. Solver settings: time_limit=90s, mip_rel_gap=0.001, threads=1, presolve=on per phase. Worker timeout: 210s. Greedy post-processing fills remaining slots respecting all hard constraints. `checkLevelFillability()` runs pre-solve to detect level shortages for diagnostics.
- **User Workflow**: A multi-step wizard guides users through schedule configuration, staff management, blocked dates, optimization, and export. Step 4 results include three view tabs: Calendar View (drag-and-drop editor), Staff View (`StaffScheduleView.tsx` — staff rows × date columns mirroring Excel Sheet 2), and Summary/Statistics.

### Backend (`server/`)

- **Technology Stack**: Express.js v5 on Node.js with TypeScript, compiled using `tsx` (dev) and `esbuild` (prod).
- **API Design**: RESTful JSON API under the `/api/` prefix, utilizing shared Zod schemas from `shared/routes.ts` for validation and typing.
- **Data Storage**: PostgreSQL database managed with Drizzle ORM. A document-store approach is used, storing complex schedule data (config, staff, results) within JSONB columns in a single `schedules` table to simplify schema management for nested structures.
- **Analytics**: `usage_logs` and `generated_schedules` tables store anonymized data for performance and usage analytics.

### Shared Code (`shared/`)

- Contains `schema.ts` for Drizzle table definitions and Zod schemas, and `routes.ts` for API route contracts. This ensures type safety and consistency across the full stack.

### Design Decisions

- **Client-side optimization**: Offloads computation from the server, improving responsiveness and user experience.
- **JSONB document store**: Simplifies data modeling for complex, nested schedule data, prioritizing development speed over relational normalization.
- **Shared route contracts**: Enhances type safety and reduces integration errors between frontend and backend.
- **shadcn/ui components**: Provides a highly customizable UI component library.

## External Dependencies

### Required Services

- **PostgreSQL Database**: Primary data persistence layer.
- **Sanity CMS**: Used for managing article and blog content, accessible via GROQ API.

### Key NPM Packages

- **drizzle-orm**: PostgreSQL ORM.
- **express**: Backend web framework.
- **@tanstack/react-query**: Frontend data fetching.
- **zod**: Schema validation.
- **framer-motion**: UI animations.
- **recharts**: Charting library.
- **wouter**: Frontend routing.
- **nanoid**: Unique ID generation.
- **Radix UI**: UI primitives.
- **date-fns**: Date manipulation.
- **@sanity/client**: Sanity CMS API client.
- **@portabletext/react**: Sanity Portable Text renderer.
- **@sanity/image-url**: Sanity image URL builder.

### Fonts

- Google Fonts: DM Sans, Outfit, Fira Code.