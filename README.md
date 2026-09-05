# WiseCard

A Hebrew/RTL SaaS for Israeli mortgage advisors — CRM, mortgage simulator, AI
intake, document handling, and dashboards. See [PLAN.md](PLAN.md) for the full
scope, data sources, and phased roadmap.

The mortgage simulator uses a shared, validated cash-flow engine for manual
mixes, finite-grid optimization, server-side saving and printable reports.
It supports seven tracks, individual terms, effective monthly CPI compounding,
reset-aware stress scenarios, insurance/cost estimates, comparison and CSV export.
Regulatory checks distinguish incomplete data from failures and indicative passes;
market readings are dated references, not bank quotes or CPI forecasts.
See [the simulator review](docs/mortgage-simulator-review.md) for corrected defects,
official sources, date-dependent rules and model limitations.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** + **Prisma 6**
- **Auth.js (NextAuth v5)** — credentials + JWT sessions (OAuth-ready)
- **Tailwind CSS v4** — RTL, Hebrew (Heebo font)

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy the example and fill in values:

   ```bash
   cp .env.example .env
   npx auth secret   # generates AUTH_SECRET
   ```

   Set `DATABASE_URL` to a Postgres instance (free: [Neon](https://neon.tech) or
   [Supabase](https://supabase.com), or local Postgres).

3. **Create the schema + seed a demo user**

   ```bash
   npm run db:push     # create tables from prisma/schema.prisma
   npm run db:seed     # demo org + user
   ```

   Demo login → `advisor@demo.local` / `password123`

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in at `/sign-in`;
   the app lives under `/app` (protected by middleware).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push schema to the database |
| `npm run db:migrate` | Create/apply a migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Project layout

```
prisma/schema.prisma     Multi-tenant data model (Org → Users, Contacts, Cases)
prisma/seed.ts           Demo org + user
src/auth.config.ts       Edge-safe auth config (used by middleware)
src/auth.ts              Full auth (Credentials + Prisma adapter)
src/proxy.ts             Protects /app/* (Next 16 proxy convention)
src/lib/prisma.ts        Prisma client singleton
src/app/                 Routes — landing (/), /sign-in, /app (dashboard)
```

## Advisor workspace

The CRM now includes a mortgage-advisor operations workspace:

- **Dashboard:** follow-ups due today, overdue work, expiring bank approvals,
  upcoming appointments, document readiness, fees and case pipeline.
- **Cases:** searchable stage board, direct case creation, editable purpose and
  amount, next action, follow-up date, expected completion and fee tracking.
- **Documents:** purpose-specific checklists, received/reviewed/not-required
  states, expiry dates and HTTPS links to files in the office's existing storage.
  Existing cases can initialize a checklist without duplicating existing items.
  This release does not upload files, OCR documents, or sign agreements.
- **Banks:** manually recorded bank quotes, contact details, per-track amounts,
  rates and terms, quoted payments, approval expiry and one selected offer per
  case. Comparisons distinguish quotes with different amounts or terms; quote
  figures are not recalculated forecasts or recommendations.
- **Calendar:** appointments linked to cases and advisors, rescheduling,
  cancellation, summaries and `.ics` export. Conflicts are checked per advisor;
  the office calendar displays Israel time and entry uses the browser's labelled
  time zone. Export is a download, not a live calendar integration.
- **Fees:** agreed/paid/outstanding totals with links back to case management.
  Amounts must use a consistent tax basis; this is not invoice generation.

All new reads and writes are scoped through the authenticated organization.
New forms include server validation, pending state and readable error messages.
Existing mortgage calculations, scenarios, printable reports and market-data
sync remain available.

For an existing installation, run `npm run db:generate` and `npm run db:push`.
The workspace schema adds tables and nullable/defaulted case fields, preserving
existing case and client data. Follow your normal database backup/review process.

Validation: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
The production build fetches the configured Heebo font from Google Fonts.

## Simulator verification and persistence

`npm test` covers financial reference cases, cash-flow invariants, reset timing,
regulatory boundaries, optimizer equivalence and existing workspace behavior.
For authenticated HTTP/database checks against an already running local dev server:

```bash
WORKSPACE_INTEGRATION=1 node --import tsx tests/workspace.integration.ts
```

The integration test creates isolated synthetic offices and removes those fixtures
in `finally`. Scenario inputs are validated and computed on the server, scoped to
the signed-in office. Version-2 snapshots preserve numeric assumptions and dates;
legacy records are retained and marked unverified until reopened and saved anew.
Scenario totals use floating-point database columns to avoid integer overflow;
calculations retain precision and displayed amounts are rounded. Apply the current
schema with `npm run db:push` after `npm run db:generate`.
