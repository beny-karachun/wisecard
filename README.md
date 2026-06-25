# WiseCard

A Hebrew/RTL SaaS for Israeli mortgage advisors — CRM, mortgage simulator, AI
intake, document handling, and dashboards. See [PLAN.md](PLAN.md) for the full
scope, data sources, and phased roadmap.

> **Status:** Phase 2 complete — mortgage simulator + mix-optimizer, scenarios
> saved to cases, and branded print/PDF reports — on top of the Phase 1 CRM
> (contacts, cases, tasks, activity) and Phase 0 foundation
> (Next.js + Prisma + Auth.js + RTL shell).

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
