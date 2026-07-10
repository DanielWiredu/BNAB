# LAMS.Server → Next.js Migration Plan

**Status:** Draft — awaiting approval. No implementation code has been written.
**Scope:** Only the `LAMS.Server` project is redeveloped. `AppMain`, `BusinessLogic`, `DataAccess`, and the database itself are untouched (though `BusinessLogic`/`DataAccess` serve as the behavioural reference, since LAMS.Server consumes them).
**Date:** 2026-07-07

---

## 1. Analysis of the Existing Application

### 1.1 What LAMS.Server actually is

LAMS.Server is a .NET 8 **Blazor Server** app (interactive server render mode) that provides:

| Concern | Current implementation |
|---|---|
| UI | ~84 Razor pages + dialogs, MudBlazor 7 + a Bootstrap admin template (wwwroot theme assets), Syncfusion referenced via shared projects |
| Auth | ASP.NET Core Identity (cookie), roles + a custom two-layer permission system |
| Data access | Shared `BusinessLogic` (`IUnitOfWork` → 8 repositories) over `DataAccess` (EF Core `ApplicationDbContext` for Identity, Dapper `SqlDataAccess` for everything else — **49 stored-procedure call sites** across 6 repositories) |
| Inbound API | `GHPACLMSController` — GPHA CLMS pushes labour requests and cost sheets into `GPHALabourRequests` / `GPHACostSheets` / `GPHACostSheetDetails` / `GPHAJobAssignments` |
| Sync job | `UtilitiesController.ProcessGPHAPendingApprovedRequests` — Hangfire recurring job (`*/10 * * * *`, per-branch queue `tema`) that folds approved GPHA cost-sheet hours back into GDLC daily requisitions |
| Background jobs | Hangfire (SQL Server storage, dashboard at `/hangfire`, gated to any authenticated user) |
| Email | MailKit SMTP (`mail.xcelisolutions.com:8889`), sends enqueued through Hangfire, supports attachments |
| Excel export | ClosedXML → byte stream → JS interop download |
| Printable reports | **Not rendered locally.** Pages deep-link to an external legacy WebForms report app (`ReportAppUrl` = `https://rptlams.gdlcwave.com`, `.aspx` viewers for cost sheets, payroll, loans) |
| Swagger | `/swagger`, gated behind login |

### 1.2 Authentication & authorization (the part with the most hidden design)

- `ApplicationUser : IdentityUser` adds `Name` and `UserKey` (an 8-char key stamped into requisition numbers — `GetNewReqNo(userKey)`).
- Cookie: 1-hour sliding expiration; security stamp revalidated every 10 minutes (kills sessions when a user is disabled or password changes).
- **Roles** (7): Admin, Manager, Operations, Auditor, Payroll, HR, Loans (`AppModels/Auth/AppRoles.cs`).
- **Permissions** (46 keys, `AppModels/Auth/AppPermissions.cs`): two-layer model —
  1. Role defaults defined **in code** (`AppPermissions.RoleDefaults`), not in the DB.
  2. Per-user overrides stored in `AspNetUserClaims` as `Type = "Permission"`, `Value = "<key>::grant"` or `"<key>::revoke"`.
  Effective = (role defaults − revokes) ∪ grants. Cached in memory 15 min per user; cache invalidated on grant/revoke.
- Nav menu and every page/action gate on permission keys, not roles.
- Startup seeds all roles and admin users from `SeedAdmins` config.
- Identity UI includes the full suite: login, register, confirm email, forgot/reset password, change email/password, 2FA + recovery codes, external logins (scaffolded; no external providers configured), personal data download/delete.

### 1.3 Domain workflows (behaviour to preserve)

All business rules live in stored procedures + repository orchestration. The repository interfaces are the authoritative behaviour contract:

**Daily requisition lifecycle** (`IDailyReqRepository`)
create (`AddDailyReq` → req no. generated from `userKey`) → allocate workers (`AddSubStaff`, transport toggle) → update hours (`UpdateDailyReqHours`) → approve/disapprove (`ApproveDailyReq`/`DisapproveDailyReq`) → payroll process (`ProcessDailyReq`) → archive (`StoreDailyReq`).

**Weekly** adds: work-days per worker (`AddWorkDay`/`UpdateWorkDay`/`RemoveWorkDay`), confirm step, duplicate-shift override (`AllowDuplicateShift`), delete-stored. **Monthly** mirrors weekly minus work-day granularity.

**GPHA CLMS integration** (two directions):
- *Inbound push:* `POST /api/GHPACLMS/CreateLabourRequest` (idempotent on `Id`) and `POST /api/GHPACLMS/CreateCostSheet` (transactional insert of job assignment + cost sheet + details).
- *Reconciliation job (every 10 min):* pending approved GPHA requests → look up matching GDLC requisition by cost-sheet number → push worker hours (`UpdateDailyReqGPHAHours`, shift type derived from rate-type string: 80/100/120% → "Shift NN%") → add workers to requisition (`AddGPHASubStaff`) with trade-group mapping ("Group 01"→30 … "Group 15"→51, **hardcoded** in `UtilitiesController`) → mark processed.
- UI: pending / all / approved request lists, cost-sheet creation dialog, CSV export.

**Approvals (audit):** daily/weekly/monthly approval pages; approve/disapprove with reasons; state-machine via paired `TblApprove*`/`TblDisapprove*`/`TblStored*` tables.

**Payroll:** process approved requisitions into cost sheets (daily/weekly/monthly), store/archive; store pages can also delete stored records (weekly/monthly).

**Loans:** scheme setup → loan creation (`AddLoan` returns generated loan no.) → approval → repayments → repayment approval (returns repaid amount + balance) → outstanding-loan check per worker → reports.

**Workers:** registration/edit, status changes, skills, tag/untag, aged-workers list, ID cards, stats; trade groups/types/rates and payroll setup maintenance.

**Setups:** Gang, Bank, Bank Branch, Nationality, Reporting Point, Cargo, Vessel, Location, DLE Company — simple CRUD.

**Audit trail:** `ReportingPoints.isLogged(date, by, description, id)` writes action logs; `AuditTrail` page reads them.

### 1.4 Technical debt observed (candidates to fix, not blindly port)

- `GHPACLMSController` bypasses the repository layer entirely (raw SQL in controller); no auth on the inbound endpoints beyond obscurity; `CompanySecret`/`CompanyKey` are stored but not verified.
- Secrets (DB, SMTP, Hangfire) committed in `appsettings.json`.
- Trade-group mapping hardcoded in a controller.
- Hangfire dashboard authorizes *any* authenticated user despite an `admin.hangfire` permission existing.
- `ExportService` builds Excel on the server and pushes through JS interop — trivial in Next.js as a route handler returning a file.
- Return-value-tuple convention (`(int ReturnValue, ...)`) encodes business outcomes as magic ints from stored procedures.
- Blazor page/dialog pairs duplicate form logic; no tests anywhere.

---

## 2. Feature Inventory & Grouping

| # | Module | Pages/endpoints | Backend surface | Complexity |
|---|---|---|---|---|
| F0 | Foundation: scaffold, DB, auth, RBAC, layout/nav, audit log | login + all Identity account pages, sidenav | Auth.js, Prisma introspection, permission engine | **High** |
| F1 | Setups (master data) | 9 CRUD pages + dialogs | `ISetupRepository` (36 methods, plain CRUD) | Low |
| F2 | Workers | Registration, Details, Aged, ID Cards, Tag/Untag | `IWorkerRepository` (17 methods, some SPs) | Medium |
| F3 | Trade & payroll setup | TradeGroup, TradeType, TradeGroupRate, PayrollSetup | part of `IWorkerRepository` | Low |
| F4 | Daily requisitions | DailyStaffReq, NewDailyStaffReq, DailyHoursUpdate | `IDailyReqRepository` (SP-heavy) | High |
| F5 | GPHA CLMS integration | Pending/All/Approved, WorkDays, NewCostSheetDialog + 2 inbound API routes + 10-min job | controller SQL + `IDailyReqRepository` GPHA methods | High |
| F6 | Weekly & monthly requisitions | WeeklyStaffReq, NewWeeklyStaffReq, MonthlyStaffReq, NewMonthlyStaffReq | `IWeeklyReqRepository`, `IMonthlyReqRepository` | High |
| F7 | Approvals (audit) | Daily/Weekly/MonthlyApproval | approve/disapprove SPs | Medium |
| F8 | Payroll process & store | Daily/Weekly/MonthlyPayroll, Daily/Weekly/MonthlyStore | Process*/Store*/DeleteStored* SPs | Medium |
| F9 | Loans | SchemeSetup, Manager, LoanDetails, Repayment, LastRepayment, Report | `ILoanRepository` (16 methods) | Medium |
| F10 | Reports & exports | Daily/Weekly/MonthlyReqReports, WorkerList + Excel/CSV export | external report app deep links + ClosedXML | Low–Medium |
| F11 | Admin | Users (roles + permission panel), AuditTrail, background-jobs dashboard | Identity tables + permission service | Medium |
| F12 | Email + background jobs infrastructure | — | MailKit → Nodemailer; Hangfire → job runner | Medium |
| — | ClientPortal pages | LabourAdvice, Daily/Weekly/MonthlySubmission | **empty stubs** — confirm before porting | None |
| — | Template demo pages | Counter, Weather, Horizontal, Empty | do not port | None |

**Dependency graph (migration-relevant):**
F0 → everything. F1/F3 → F2 (worker forms need banks, nationalities, trade groups). F2 → F4/F6/F9 (allocation and loans reference workers). F4 → F5 (GPHA job writes into daily requisitions), F7, F8. F6 → F7, F8. F9 independent after F2. F10/F11 last. F12 needed by F0 (password reset email) and F5 (sync job).

---

## 3. Target Architecture

### 3.1 Folder structure (new repo/app: `lams-next/`)

```
lams-next/
├─ app/
│  ├─ (auth)/login, forgot-password, reset-password/…
│  ├─ (dashboard)/
│  │  ├─ workers/…            # registration, [id], aged, id-cards, tag-untag
│  │  ├─ operations/…         # daily, weekly, monthly requisitions, hours
│  │  ├─ clms/…               # pending, all, approved
│  │  ├─ audit/…              # daily/weekly/monthly approval
│  │  ├─ payroll/…            # process + store pages
│  │  ├─ loans/…
│  │  ├─ setups/…
│  │  ├─ admin/…              # users, audit-trail, jobs
│  │  └─ reports/…
│  └─ api/
│     ├─ auth/[...nextauth]/route.ts
│     ├─ clms/labour-request/route.ts     # was GHPACLMSController
│     ├─ clms/cost-sheet/route.ts
│     └─ exports/…                        # Excel/CSV downloads
├─ components/         # shadcn/ui primitives + shared composites (DataTable, FormDialog, ConfirmDialog)
├─ features/<module>/  # module-scoped components + hooks (no business logic)
├─ server/
│  ├─ services/        # business logic (requisition-service, loan-service, clms-service…)
│  ├─ repositories/    # Prisma/mssql data access — the only layer that touches the DB
│  ├─ auth/            # permissions.ts (ported AppPermissions), password.ts, session helpers
│  └─ integrations/clms/   # isolated GPHA module: schemas, handlers, reconciliation
├─ db/                 # prisma/schema.prisma, mssql pool, procedures.ts (typed SP wrappers)
├─ jobs/               # worker entrypoint + job definitions (clms-reconcile, send-email)
├─ emails/             # templates
├─ schemas/            # Zod schemas (shared client/server validation)
├─ types/  hooks/  lib/  utils/
├─ middleware.ts       # session check + route-level permission gate
└─ tests/              # vitest unit (services), playwright e2e (critical flows)
```

**Layering rule:** route handlers/server actions do *validation (Zod) → service → repository*. No SQL in routes, no business logic in components. This mirrors the existing UnitOfWork discipline, which is the one architectural habit the current app gets right.

### 3.2 Database access — Prisma + node-mssql (ADR-002)

The existing app already mixes EF Core and Dapper, so a dual strategy is faithful and low-risk:

- **Prisma** (introspected via `prisma db pull`, models `@@map`-ed to existing names) for CRUD tables: all `Tbl*` setups, workers, loans schemes, GPHA tables, Identity tables. **No Prisma migrations — the SQL schema stays authoritative.**
- **node-mssql** for the 49 stored-procedure call sites, because the SPs use **return values and output params** (`(int ReturnValue, string LoanNo)` tuples) which Prisma's `$queryRaw` cannot capture. Each SP gets one typed wrapper in `db/procedures.ts` (e.g. `spAddDailyReq(input): Promise<{ autoNo: number; returnValue: number }>`), turning magic-int returns into discriminated unions at the boundary.
- **Views (`Vw*`)** are queried read-only through Prisma (introspected as models) — same as today.
- **Do not touch:** all tables/SPs/views are shared with AppMain and the report app. Nothing is renamed, altered, or migrated. The new app is a pure client of the existing schema.

### 3.3 Authentication — Auth.js v5 (ADR-003)

**Table mapping (reuse Identity tables as-is; no data migration):**

| ASP.NET Identity | New usage |
|---|---|
| `AspNetUsers` | User store. `Email`/`UserName` for login; `Name`, `UserKey` carried into the session/JWT (UserKey is required for req-no generation). `EmailConfirmed`, `LockoutEnd`, `AccessFailedCount` honoured. |
| `AspNetUsers.PasswordHash` | **Verified in Node.** Identity v3 format: `0x01 ‖ prf ‖ iterations ‖ saltLen ‖ salt ‖ subkey` (PBKDF2-HMAC-SHA256, 32-byte subkey). Implement `verifyIdentityV3Hash()` with `crypto.pbkdf2` — well-documented format, ~40 lines. On successful login, transparently re-hash to Argon2id and mark format so both apps' credentials keep working during coexistence (verify supports both formats). |
| `AspNetRoles` / `AspNetUserRoles` | Role lookup at sign-in. |
| `AspNetUserClaims` | Permission overrides — keep the exact `Permission` / `::grant` / `::revoke` convention so the Blazor app and the Next.js app compute identical effective permissions during coexistence. |
| `AspNetUserTokens` / 2FA columns | Password-reset tokens replaced by a `PasswordResetTokens` approach via Auth.js-adjacent custom flow (or a new small table — TBD; it's additive, not a schema change to existing tables). 2FA: **parked** — confirm whether anyone actually uses TOTP today before rebuilding it. |
| `SecurityStamp` | Session invalidation: embed the stamp in the JWT and re-check it against the DB every ≤10 min (mirrors `SecurityStampValidatorOptions`), so disabling a user still kills live sessions. |

**Session model:** JWT strategy, 1-hour sliding window (matches current cookie). Token carries `userId`, `userKey`, `name`, `roles`. **Effective permissions are computed server-side per request from role defaults (ported `permissions.ts`) + claims, cached 15 min (LRU) with explicit invalidation on grant/revoke — identical semantics to `PermissionService`.** Permissions are *not* baked into the JWT, preserving today's "changes apply within 15 min without re-login" behaviour.

**Enforcement:** `middleware.ts` handles authenticated-or-redirect; a `requirePermission("daily_req.create")` helper guards every server action/route handler; a `<Can permission=…>` client hook (fed by a server-provided permission set) drives nav/UI visibility, mirroring `Sidenav.razor`.

### 3.4 GPHA CLMS integration — isolated module (ADR-004)

`server/integrations/clms/` owns everything GPHA:

- **Inbound endpoints** (`/api/clms/labour-request`, `/api/clms/cost-sheet`): Zod-validated DTOs matching `GPHACreateLabourRequest` / `GPHACreateCostSheetRequest` field-for-field; idempotency on `Id` preserved; transactional inserts via mssql transaction. **Improvement:** actually verify `CompanyKey`/`CompanySecret` against configured values, add a shared-secret header, and log every inbound payload to an integration log table. *(Coordination required: GPHA must be able to send the same JSON to a new URL — keep paths/payloads byte-compatible and put the new app behind the same host at cutover so ideally nothing changes on their side.)*
- **Reconciliation job**: port of `ProcessGPHAPendingApprovedRequests` — same SP calls, same shift-type derivation, same processed-marking. **Improvement:** move the hardcoded trade-group map ("Group 01"→30…) into a DB table or config, add structured logging per request, retry with backoff on transient SQL errors, and make the run idempotent per request-number (it already mostly is — preserve that).

### 3.5 Background jobs — BullMQ + Redis, worker process (ADR-005)

Hangfire's actual usage here is small: (1) the 10-minute CLMS reconciliation cron, (2) fire-and-forget email sends. Recommendation:

- **BullMQ + Redis** (one small Redis container) with a standalone Node worker (`jobs/worker.ts`) deployed beside the Next.js app. Repeatable job = CLMS reconcile (`*/10 * * * *`); queue = email. Queue name per branch (`tema`) maps to a BullMQ queue prefix, preserving the multi-branch design.
- Admin visibility via **Bull Board** mounted behind the `admin.hangfire` permission (fixing today's any-authenticated-user hole).
- *Why not Trigger.dev/Inngest:* this system runs against a self-hosted SQL Server with private SMTP; keeping jobs on-box avoids a new cloud dependency and egress of payroll data. *Why not node-cron alone:* no retries, no visibility, no queue semantics for email.
- **Transition note:** the Hangfire recurring job registered by AppMain/LAMS.Server must be disabled at cutover or hours will be double-pushed (the SPs are guarded — `staffReq.Approved` / `Normal == 0` checks — but don't rely on that).

### 3.6 Email — Nodemailer (ADR-006)

Same SMTP host/port (8889) via Nodemailer, sent from the job queue (as today), templates in `emails/` (react-email or plain HTML). Resend is rejected: the org already runs its own SMTP relay and mail must keep flowing from `noreply@xcelisolutions.com`.

### 3.7 Reports & exports (ADR-007)

- **Phase 1 (parity):** keep deep-linking to `ReportAppUrl` (`rptlams.gdlcwave.com` .aspx viewers) exactly as today. Zero risk, zero work beyond building the URLs.
- **Phase 2 (optional, post-cutover):** rebuild the highest-traffic prints (daily cost sheet, loan statement) as server-rendered print-CSS pages or Playwright-generated PDFs, retiring the WebForms app gradually.
- **Excel/CSV exports:** route handlers using `exceljs`, streamed as downloads — replaces ClosedXML + JS interop and works without any client plumbing.

### 3.8 UI approach

- Server components for all list/report pages (data fetched server-side, permission-checked); client components only for forms, dialogs, and interactive tables.
- Shared building blocks built once in F0/F1 and reused everywhere: `DataTable` (TanStack Table: server pagination, column filters, export button), `FormDialog` (RHF + Zod), `ConfirmDialog`, `PageHeader`/breadcrumb, permission-aware `SidebarNav` (structure ported 1:1 from `Sidenav.razor`).
- TanStack Query for client-side mutations/refetch; optimistic updates only for low-risk toggles (e.g. transport toggle), never for approvals or payroll.
- The requisition builder pages (find-worker dialogs, allocation grid, hours entry) are the UX centrepiece — redesign as a two-pane allocate/review flow rather than copying the Blazor dialog chain.

---

## 4. Migration Order, Complexity & Timeline

Strangler-fig: the Next.js app goes live module-by-module against the **same database**, while LAMS.Server stays available as fallback. Order follows the dependency graph:

| Phase | Content | Est. complexity | Exit criteria |
|---|---|---|---|
| 0 | Scaffold, Prisma introspection, mssql SP layer, Auth.js (login/logout/reset, Identity-hash verify), permission engine + middleware, layout/nav, audit-trail write, seed check | High — **the** foundation | Login with existing credentials; nav renders per-permission identically to Blazor for same user |
| 1 | Setups CRUD (9 entities) + shared DataTable/FormDialog patterns | Low | CRUD parity, audit entries written |
| 2 | Workers + trade/payroll setup + tag/untag + aged + ID cards | Medium | Worker create matches SP outputs (GPHA group/job IDs) |
| 3 | Daily requisitions + allocation + hours update | High | Full daily lifecycle reproducible against a test copy of GDLCDB |
| 4 | CLMS: inbound API routes + reconciliation job (BullMQ infra + email queue land here) | High | Replayed GPHA payloads produce identical rows; job output matches Hangfire run on same data |
| 5 | Approvals daily/weekly/monthly + weekly/monthly requisitions | High | Approve/disapprove/confirm parity incl. duplicate-shift override |
| 6 | Payroll process + store/delete-stored + payroll audit pages | Medium | Processed cost-sheet counts match legacy for same inputs |
| 7 | Loans end-to-end | Medium | Loan no. generation, repayment balances match |
| 8 | Reports links, Excel/CSV exports, worker list | Low–Medium | Every legacy export reproducible |
| 9 | Admin: users, roles, permission panel, audit trail viewer, Bull Board | Medium | Grant/revoke round-trips visible to the *Blazor* app too (shared claims) |
| 10 | Cutover: DNS/host swap for GPHA endpoints, disable legacy Hangfire job, decommission LAMS.Server UI | — | 2-week parallel-run sign-off |

Testing throughout: Vitest for services (esp. permission engine, shift-type derivation, Identity-hash verify), Playwright for login + one golden path per phase. Since the legacy system has zero tests, **parity is verified by running both apps against the same restored DB snapshot and diffing DB state after identical operations.**

---

## 5. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Business logic hidden in stored procedures (return-code semantics undocumented) | **High** | Don't rewrite SPs — call them. Extract `sql/database-schema.sql` SP definitions into a mapping doc as each module is ported; encode return codes as typed unions. |
| Password hash incompatibility / lockout at cutover | High | Verify Identity v3 hashes in Node (test against known accounts on a DB copy *first*); dual-format verify during coexistence; never bulk-rehash. |
| GPHA inbound endpoint change breaks the feed | High | Keep payloads/paths byte-compatible; cut over at the host/reverse-proxy level; keep legacy endpoint alive read-only for 2 weeks; integration log table to spot drops. |
| Double-processing during parallel run (two reconciliation jobs) | Medium | Only one scheduler enabled at a time per branch queue; feature flag; the SP-level guards are the backstop, not the mechanism. |
| Shared DB with AppMain — a "cleanup" in the new app corrupts the other app's assumptions | Medium | Hard rule: no schema changes, no data backfills, additive tables only (e.g. integration log). |
| Permission model divergence between apps during coexistence | Medium | Port `AppPermissions` verbatim (keys, role defaults, claim format); single source file with a checksum test against the C# list. |
| Windows/on-prem deployment of Node stack (Redis, worker process, reverse proxy) | Medium | Deployment guide + IIS w/ iisnode is painful — recommend standalone Node behind existing reverse proxy or Docker Compose (app + worker + redis); confirm hosting constraints early (open question #3). |
| No existing tests; parity is judgement-based | Medium | DB-state diffing methodology (above) + golden-path Playwright suite kept as the permanent regression net. |
| Secrets currently in repo | Low (but act now) | All secrets to `.env` (documented below); rotate the DB/SMTP credentials that are already exposed in git history. |

---

## 6. Assumptions & Open Questions (answers needed before Phase 0 ends, not before it starts)

1. **ClientPortal pages** (`LabourAdvice`, `Daily/Weekly/MonthlySubmission`) are empty stubs — assume out of scope. Confirm.
2. **2FA/external logins:** scaffolded Identity pages exist, but are they used by anyone? Assume no → park.
3. **Hosting target** for the Next.js app (Windows server beside IIS? Docker? Linux VM?) — affects ADR-005 and the deployment guide.
4. **`appsettings.json` points at `bnabdb`**, not `GDLCDB` — confirm which database the production LAMS.Server runs against so parity testing uses the right snapshot.
5. **Who calls the inbound CLMS endpoints** — GPHA directly, or an intermediary? Determines how much freedom we have on auth hardening (ADR-004).
6. **Report app longevity:** is `rptlams.gdlcwave.com` staying up? Phase-1 parity depends on it.
7. The recurring CLMS job is registered via an `[AllowAnonymous]` endpoint today — assume this was a bootstrapping hack; the new job is registered by the worker itself, no public trigger.

---

## 7. Environment Variables (initial set)

```
DATABASE_URL=            # sqlserver:// (Prisma) — GDLCDB
MSSQL_*                  # host/db/user/pass for the mssql pool (SP calls)
AUTH_SECRET=             # Auth.js JWT secret
AUTH_URL=                # canonical app URL (was AppUrl)
REDIS_URL=               # BullMQ
SMTP_HOST= SMTP_PORT=8889 SMTP_USER= SMTP_PASS= SMTP_SENDER_NAME=
CLMS_SHARED_SECRET=      # inbound endpoint auth (new)
BRANCH_QUEUE=tema        # was HangfireSettings:QueueName
REPORT_APP_URL=https://rptlams.gdlcwave.com
SEED_ADMIN_EMAILS= SEED_ADMIN_DEFAULT_PASSWORD=
```

---

## 8. ADR Index (to be written as decisions are enacted)

- ADR-001 Strangler-fig migration against the shared database (no big-bang, no schema changes)
- ADR-002 Prisma for CRUD + node-mssql for stored procedures
- ADR-003 Auth.js credentials provider over existing ASP.NET Identity tables; permissions computed per-request, not in JWT
- ADR-004 CLMS as an isolated integration module with byte-compatible inbound contracts
- ADR-005 BullMQ + Redis worker process replaces Hangfire
- ADR-006 Nodemailer over existing SMTP (Resend rejected)
- ADR-007 Phase-1 report deep-links; phased PDF rebuild later

## 9. Living Documents (created/maintained during implementation)

`docs/nextjs-migration/`: `MIGRATION-CHECKLIST.md`, `FEATURE-PARITY.md`, `DB-MAPPING.md` (table/SP/view → Prisma model/procedure wrapper), `API-MAPPING.md` (old controller/page action → new route/server action), `AUTH-DESIGN.md`, `DEPLOYMENT.md`, `adr/ADR-00x-*.md`.
