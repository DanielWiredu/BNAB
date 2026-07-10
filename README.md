# GDLC LAMS — Next.js

Modern redevelopment of the **LAMS.Server** Blazor app (Labour and Allocation
Management System, Ghana Dockyard Labour Company) on Next.js 15.

This runs against the **existing, shared SQL Server database** — it never alters
the schema. See [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md) for the full
strategy and [`docs/MIGRATION-CHECKLIST.md`](docs/MIGRATION-CHECKLIST.md) for
progress.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn/ui ·
Auth.js v5 · Prisma (CRUD) + node-mssql (stored procedures) · TanStack
Query/Table · Zod · Pino · BullMQ (jobs, Phase 4) · Nodemailer (email, Phase 4).

## Getting started

```bash
npm install
cp .env.example .env      # then fill in DB/SMTP/secrets (a dev .env is included)
npx auth secret           # generate AUTH_SECRET

# Optional: reverse-engineer Prisma models from the live DB
npm run db:pull
npm run db:generate

# Ensure roles + admin users exist (ports Program.cs startup seeding)
npm run seed

npm run dev               # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (permission-parity + password-hash tests) |
| `npm run db:pull` | Introspect the live DB into `prisma/schema.prisma` |
| `npm run seed` | Seed roles + admin users |
| `npm run worker` | Background job worker (Phase 4) |

## What's implemented (Phase 0)

- **Auth** — Auth.js credentials login against existing ASP.NET Identity tables;
  verifies Identity V2/V3 password hashes in Node; transparent re-hash to V3;
  JWT session with a 1-hour sliding window and throttled security-stamp
  revalidation (session dies when a user is disabled / password changes).
- **RBAC** — the two-layer permission model ported verbatim from
  `AppPermissions.cs` (role defaults + per-user grant/revoke claims), computed
  per-request and cached 15 min. `requirePermission()` guards server code;
  `<Can>` / `usePermissions()` drive the UI.
- **Shell** — permission-aware sidebar (1:1 with `Sidenav.razor`), topbar with
  sign-out, dashboard home, access-denied page, login/forgot-password pages.
- **Data layer** — Prisma client + mssql pool with a typed stored-procedure
  helper (captures OUTPUT params + RETURN values), audit-trail writer
  (`spAddAuditTrail`), seeding script.

## Project layout

```
src/
  app/              # routes: (auth), (dashboard), api/
  components/       # ui/ (shadcn), layout/ (sidebar, topbar)
  features/         # module UI + client hooks (auth/…)
  server/           # server-only logic
    auth/           # permissions, permission-service, identity-hash, guards
    repositories/   # DB access (user-repository over Identity tables)
    audit/          # audit-trail writer
  db/               # prisma client, mssql pool, procedures, seed
  lib/  types/
  auth.ts  auth.config.ts  middleware.ts
prisma/schema.prisma
docs/               # migration plan, checklist, auth & DB mapping
```

## Important constraints

- **Never** run `prisma migrate` — the database is authoritative and shared with
  the legacy apps. Use `prisma db pull` to sync models.
- Secrets in the included dev `.env` are carried over from the legacy app and are
  already exposed in git history — **rotate them** before production.
