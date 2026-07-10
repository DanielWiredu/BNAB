# Migration Checklist

Tracks the 11-phase plan in `MIGRATION-PLAN.md`. Update as work lands.

## Phase 0 — Foundation, Auth & RBAC  🟡 in progress

- [x] Next.js 15 + TS + Tailwind v4 + shadcn/ui scaffold
- [x] Prisma client + node-mssql pool + typed SP wrapper (`callProcedure`)
- [x] Prisma schema — Identity + audit tables (introspection to follow)
- [x] Permission engine ported from `AppPermissions.cs` (+ parity test)
- [x] Effective-permission service with 15-min cache + invalidation
- [x] Identity V2/V3 password verify + V3 re-hash (+ round-trip/vector tests)
- [x] Auth.js v5 credentials login, JWT session (1-hr sliding)
- [x] Security-stamp revalidation (throttled, Node-only)
- [x] Edge middleware (authenticated-or-redirect) + `requirePermission` guards
- [x] Permission-aware sidebar (1:1 with `Sidenav.razor`), topbar, dashboard
- [x] Login / forgot-password / access-denied pages
- [x] Audit-trail writer (`spAddAuditTrail`)
- [x] Role + admin-user seeding script (ports `Program.cs`)
- [x] Docs: plan, auth design, DB mapping, checklist
- [x] `tsc --noEmit` clean · `vitest` 15/15 pass (hash V2/V3 + permission parity) · `next build` OK (7 routes, middleware compiled)
- [x] **Live DB reachable + schema verified** (`npm run db:check`): all Identity + audit tables/columns present, `spAddAuditTrail` present. 3 users, all `EmailConfirmed=1`, V3 hashes → existing credentials will authenticate. `danielwiredu@gmail.com` has all 7 roles.
- [x] Dev server boots; `/login` serves 200; root redirects through auth middleware.
- [ ] **Interactive login smoke test** (user): log in, confirm sidebar renders per-permission.
- [ ] `prisma db pull` to lock in introspected models (optional — column names already verified via db:check).

## Phase 1 — Setups (master data)  🟡 code complete, pending live-DB verify

- [x] Prisma models for 9 setup tables (tblGangs, tblVessel, tblCargo, tblNationality, tblLocation, tblReportingPoint, tblBanks, tblBankBranches, tblDLECompany)
- [x] Reusable UI: `DataTable` (TanStack), `ConfirmDialog`, dialog/select/table/toast primitives, `PageHeader`
- [x] Generic CRUD engine: server-only `registry.ts` (model + schema + permission + audit metadata per resource), 3 generic server actions (`createRecord`/`updateRecord`/`deleteRecord`) with permission checks + audit-trail writes + friendly DB-error mapping, client `ResourceManager` (table + add/edit form + delete confirm)
- [x] Zod schemas (isomorphic) for all 9 entities
- [x] 9 pages: `/setups/{gang,vessel,cargo,nationality,location,reporting-point,bank,bank-branch}` + `/tools/dle-company`; bank-branch joins bank name + bank dropdown
- [x] `tsc` clean · `vitest` 15/15 · `next build` OK (16 routes)
- [x] **Live schema verified** (`npm run db:check`) — all 9 setup tables + columns match; real data present (113 gangs, 30 banks, 1,398 branches, 3,404 vessels, 19 cargo, 1 DLE company).
- [ ] **CRUD round-trip** (user, via UI) — add/edit/delete a setup record against `bnabdb`, confirm audit rows written.


## Phase 2 — Workers + trade/payroll setup  🟡 code complete (F2 + F3), pending live-DB verify

### F3 — Trade & payroll setup  🟡 code complete, pending live-DB verify
- [x] Prisma models for 4 tables (tblTradeGroup, tblTradeType, tblTradeGroupRates, tblPayrollSetup), columns mapped from `sql/database-schema.sql`
- [x] **Trade Group** + **Trade Type** via the generic setups CRUD engine — extended `registry.ts`/`schema.ts`/`ui.ts`/`queries.ts`; Trade Type joins group name + group dropdown (bank-branch pattern); Trade Group has a per-row **Rates** link and no delete
- [x] Reusable `ResourceManager` extended with declarative `rowLink` + `canDelete` (serializable, no functions in props)
- [x] SP wrappers `spAddTradeGroupRate` / `spAddPayrollSetup` in `procedures.ts` (return-code map: 0 ok, -20 duplicate effective date, -19 stale date)
- [x] Effective-dated **Rates** feature (`features/rates/`): server registry + queries, `createRate` (via SP; DLE columns carried forward from prior rate) / `updateRate` (in-place via Prisma), client `RatesManager` (numeric grid + effective/end date), shared `RatesPage`
- [x] Pages: `/tools/trade-group`, `/tools/trade-type`, `/tools/trade-group/[groupId]/rates`, `/tools/payroll-setup` (nav routes already existed)
- [x] `tsc` clean · `vitest` 15/15 · `next build` OK (19 routes)
- [ ] **Live-DB verify** (user): add/edit trade group, type, rate, payroll setup against `bnabdb`; confirm SP effective-date chaining + audit rows

### F2 — Workers  🟡 code complete, pending live-DB verify
- [x] Prisma view models `VwWorker` (vwWorkers) + `VwTblWorker` (vwTblWorkers) — read-only; binary Pics column omitted
- [x] SP wrappers `spAddWorker` (AutoID + GPHA group/job id outputs), `spUpdateWorker`, `spSetWorkerStatus`, `spUpdateWorkerTrade` in `procedures.ts`; shared `workerInputParams` maps the ~44 columns once
- [x] `features/workers/`: zod `workerSchema` (ports WorkerModel validation incl. phone/SSF/GHA-ID patterns + Ezwich/Bank conditional refinements), queries (list/find + 7 lookup loaders), actions (`createWorker`/`updateWorker`/`updateWorkerSkill`/`setWorkerStatus` + cascading `fetchTradeTypeOptions`/`fetchBankBranchOptions`)
- [x] `WorkerList` (TanStack table, edit link, add-new); `WorkerForm` (sectioned Identity/Personal/Official/Skills, cascading trade-group→type & bank→branch selects, payment-option gating, in-form Update Skill); `StatusManager` (tag/untag dialog)
- [x] Pages: `/workers/registration` (list), `/workers/registration/new`, `/workers/registration/[workerId]` (edit), `/workers/aged` (age column), `/tools/tag-untag`
- [x] `/workers/id-cards` placeholder (legacy IDcard.razor is an empty stub; deferred to Phase 8 reports + photo capture)
- [x] `tsc` clean · `vitest` 15/15 · `next build` OK (26 routes)
- [ ] **Live-DB verify** (user): register a worker (confirm AutoID + GPHA ids resolve), edit, update skill, tag/untag; confirm audit rows
- Deferred (faithful to legacy): worker photo persistence (legacy UploadImage is a no-op), Print button, Find dialog (list search covers it)

## Phase 3 — Daily requisitions + allocation + hours (F4)  🟡 code complete, pending live-DB verify

- [x] Prisma models: `tblStaffReq` (header, read), `tblSubStaffReq` (allocation, used for delete), `VwDailyReq` (list), `VwSubStaffReq` (allocation view) — cols from `sql/database-schema.sql`
- [x] SP wrappers in `procedures.ts`: `spGetNewDailyReqNo` (output ReqNo), `spAddDailyReq` (output AutoNo) / `spUpdateDailyReq` (shared `dailyReqParams`, passes zero `time(0)` cols), `spDeleteDailyReq`, `spAddSubStaffReq` (0 ok / **-73 headman**), `spToogleWorkerTransport`, `spUpdateDailyReqHours` (**-20 already approved**)
- [x] `features/daily-req/`: `requisitionSchema` (company/vessel/gang required, hours 0–8), `hoursUpdateSchema` (Normal must == 8), queries (list/get/6 lookup loaders/substaff/active-worker search), actions (create/update/delete req, addSubStaff, removeSubStaff via Prisma, toggleTransport, getNewReqNo, updateHours, loadReqForHours)
- [x] Reusable `ComboBox` (native `<datalist>` type-ahead — handles the 3.4k-vessel list); `RequisitionEditor` (header form + composed allocation), `AllocationGrid` (add/remove/toggle-transport), `WorkerPickerDialog` (search active workers, multi-add, headman guard), `HoursPanel` (lookup + confirm hours), `DailyReqList` (approved rows block delete)
- [x] Pages: `/operations/daily` (list), `/operations/daily/new`, `/operations/daily/[reqNo]` (edit + allocate), `/operations/hours`
- [x] `tsc` clean · `vitest` 15/15 · `next build` OK (27 routes)
- [ ] **Live-DB verify** (user): create a requisition (confirm ReqNo generated + AutoNo), allocate/remove workers (headman rule), toggle transport, edit, delete, update hours (8-hr rule + approved block)
- Deferred: GPHA-sourced requisitions + CLMS pending/approved (Phase 4 = F5); approvals (Phase 5); Print/report deep-links (Phase 8 native reports)
## Phase 4 — CLMS inbound API + reconciliation job (BullMQ + email)  🟡 code complete, pending live-DB + Redis verify

**Infrastructure (first use of BullMQ + Redis + email in the migration):**
- [x] Deps: `bullmq` + `nodemailer` (ioredis is bundled by bullmq); `serverExternalPackages` extended
- [x] `src/jobs/connection.ts` — `redisConnection()` parses `REDIS_URL` into BullMQ options (`maxRetriesPerRequest: null`); options-not-instance avoids the ioredis version conflict
- [x] `src/jobs/queues.ts` — lazy `getEmailQueue()`/`getClmsQueue()`; queue names prefixed with `BRANCH_QUEUE` (`tema:email`, `tema:clms`); reconcile cron `*/10 * * * *`
- [x] `src/server/email/mailer.ts` (Nodemailer over existing SMTP) + `emails/templates.ts` (password reset, CLMS summary) + `src/server/email/email-queue.ts` (`enqueueEmail`)
- [x] `src/jobs/worker.ts` — hosts the CLMS + email Workers, registers the repeatable reconcile job idempotently, graceful shutdown (`npm run worker`)

**Prisma models + SP:**
- [x] 5 models added: `GPHALabourRequests`, `GPHAJobAssignments`, `GPHACostSheets`, `GPHACostSheetDetails`, `TblGphaLabourRequest` (cols from `sql/database-schema.sql`; decimals as `Decimal`, GUIDs as `UniqueIdentifier`)
- [x] SP wrapper `spAddDailyReqGphaRequest` in `procedures.ts` (0 ok / **-23 already has cost sheet**)

**CLMS integration module (`src/server/integrations/clms/`):**
- [x] `shift-type.ts` (+ **3 vitest tests**, parity with legacy `GetShiftType`, 80→100→120 order)
- [x] `trade-groups.ts` — GPHA level → trade-group id map lifted out of the controller (ADR-004); optional `CLMS_TRADE_GROUP_MAP` env override
- [x] `schemas.ts` — Zod validators byte-compatible with `GPHACreate*` DTOs (PascalCase wire → camelCase)
- [x] `inbound.ts` — `createLabourRequest` (idempotent on Id; insert fires `trg_Insert_GPHALabourRequests` → `tblGPHA_LabourRequests`) + `createCostSheet` (Prisma `$transaction`: job assignment → cost sheet → details)
- [x] `reconcile.ts` — faithful port of `ProcessGPHAPendingApprovedRequests` (pending assignments → GDLC request → cost sheet → per-worker hours + AddGPHASubStaff insert-if-absent → mark processed); pre-loop `staffReq` snapshot preserved for parity
- [x] `auth.ts` — `x-clms-secret` shared-secret gate + optional CompanyKey/CompanySecret verification (ADR-004); each enforced only when configured
- [x] `handlers.ts` — shared route handlers mirroring the legacy response shapes

**Inbound API routes:**
- [x] Canonical `/api/clms/labour-request` + `/api/clms/cost-sheet`
- [x] Legacy-compatible aliases `/api/GHPACLMS/CreateLabourRequest` + `/api/GHPACLMS/CreateCostSheet` (byte-compatible path for cutover with no caller change)

**UI (`features/clms/` + pages):**
- [x] `queries.ts` — pending/approved/all list reads (mssql `query()`, LEFT JOIN `tblStaffReq` for Prepared On, mirrors legacy Dapper)
- [x] `ClmsList` (date-range filter bar → searchParams, TanStack table, per-variant columns), `CostSheetDialog` (prefilled from pending request → `spAddDailyReq_GPHARequest`), client CSV export (gated on `clms.export`)
- [x] Pages `/clms/pending`, `/clms/all`, `/clms/approved` (nav links already existed)
- [x] `tsc` clean · `vitest` 18/18 · `next build` OK (44 routes)
- [ ] **Live-DB + Redis verify** (user): start Memurai/Redis + `npm run worker`; POST a sample labour request + cost sheet to the inbound routes; confirm `tblGPHA_LabourRequests` populated via trigger and reconcile folds hours into a matching requisition; create a cost sheet from a pending request (-23 on duplicate)
- Deferred faithfully: inbound integration-log **table** (logged via structured pino instead — no schema change); ops summary email is opt-in

## Phase 5 — Weekly/Monthly requisitions + Approvals  🟡 code complete (F6 + F7), pending live-DB verify

- [x] SP wrappers in `procedures.ts`: generic `approveReq`/`disapproveReq`/`confirmReq` → daily/weekly/monthly approve+disapprove + weekly/monthly confirm; monthly add/update/delete (+ `spGetNewMonthlyReqNo`); weekly add/update/delete + `spGetNewWeeklyReqNo` + workday add/update/toggle + allow-duplicate-shift (weekly wrappers ready for next turn)
- [x] Prisma models: `tblStaffWReq`, `tblStaffMReq` (per-worker headers), `tblSubStaffWReq` (workday delete), `VwWeeklyReq`, `VwMonthlyReq`, `VwSubStaffWreq`

### F6 — Monthly requisitions  🟡 code complete, pending live-DB verify
- [x] `features/monthly-req/`: `monthlyReqSchema` (company + worker required, YYYYMM period, day-count fields), queries (list/get-with-joins/3 lookup loaders), actions (create/update/delete/confirm + `getNewMonthlyReqNo` + worker search)
- [x] `MonthlyReqList`, `MonthlyEditor` (ComboBox lookups + reusable `WorkerSelectDialog` sets worker/trade-group/type, period + day-count grid, Confirm button)
- [x] New reusable `WorkerSelectDialog` in `features/workers/` (single-select worker search; weekly will reuse)
- [x] Pages: `/operations/monthly` (list), `/operations/monthly/new`, `/operations/monthly/[reqNo]`

### F7 — Approvals (Daily/Weekly/Monthly)  🟡 code complete, pending live-DB verify
- [x] `features/approvals/`: unified `loadForApproval(period)` (reuses daily/monthly queries + inline weekly read), generic `approve`/`disapprove` actions with a per-period config map + **server-side re-validation of legacy rules** (daily: workers present + Normal==8; weekly: work days present; disapprove blocked when Stored)
- [x] `ApprovalPanel` (lookup → summary + period-specific child table → approve/disapprove with approval-date); `ApprovalPage` wrapper
- [x] Pages: `/audit/daily`, `/audit/weekly`, `/audit/monthly`
- [x] `tsc` clean · `vitest` 15/15 · `next build` OK (33 routes)
- [ ] **Live-DB verify** (user): create+confirm a monthly req; approve/disapprove daily & monthly cost sheets (rules enforced)

### F6 — Weekly requisitions  🟡 code complete, pending live-DB verify
- [x] `features/weekly-req/`: `weeklyReqSchema` (header, company + worker required) + `workDaySchema` (Normal/Overtime 0–12, night/holiday flags), queries (list/get-with-joins/workdays/4 lookup loaders), actions (create/update/delete/confirm/**allow-duplicate-shift** + workday add/update/remove/toggle-transport + `getNewWeeklyReqNo` + worker search)
- [x] `WeeklyReqList`, `WeeklyEditor` (header like monthly minus period/day-counts + reusable `WorkerSelectDialog` + `WorkDaysGrid`, Confirm + Allow-Duplicate-Shift buttons)
- [x] `WorkDaysGrid` + `WorkDayDialog` — **add mode stays open and auto-advances the date** (matches legacy AddWorkDayDialog); weekend flag derived server-side (Sat/Sun or holiday); add surfaces the `-20` "already worked this day/shift (Cost Sheet …)" message via the SP's paidReqNo output
- [x] Pages: `/operations/weekly` (list), `/operations/weekly/new`, `/operations/weekly/[reqNo]`
- [x] `tsc` clean · `vitest` 15/15 · `next build` OK (36 routes)
- [ ] **Live-DB verify** (user): create+confirm a weekly req; add/edit/remove work days (duplicate day/shift rejected), toggle transport, allow-duplicate-shift; approve via `/audit/weekly`
## Phase 6 — Payroll process + store  🟡 code complete, pending live-DB verify

- [x] SP wrappers in `procedures.ts`: generic `runPayroll(proc, byParam, countParam, {startDate,endDate,actor})` → `spProcess{Daily,Weekly,Monthly}Req` (`processedby`/`processedCostSheets`), `spStore{Daily,Weekly,Monthly}Req` (`storedby`/`storedCostSheets`), `spDeleteStored{Weekly,Monthly}Req` (`deletedby`/`deletedstoredCostSheets`). Each returns `{ costSheets (OUTPUT), returnValue }`. Daily has **no** delete-stored SP.
- [x] `features/payroll/`: `payrollRangeSchema` (start ≤ end), single `runPayrollOp(op, period, values)` action dispatcher (process needs `payroll.process`; store + delete-stored need `payroll.store`) + reusable `PayrollRunner` card (date range → button, shows affected count or an op-specific "nothing found" warning; delete-stored uses the destructive variant)
- [x] Pages: `/payroll/{daily,weekly,monthly}` (Process); `/tools/store/{daily,weekly,monthly}` (Store; weekly/monthly also expose Delete-Stored — legacy had that button commented, we wire it under `payroll.store`)
- [x] Zero-count → warning (not error); `returnValue != 0` with count > 0 → failure; success writes an audit row (`PROCESS/STORE/DELETE STORED <period> Payroll`)
- [x] `tsc` clean · `vitest` 18/18 · `next build` OK (50 routes)
- [ ] **Live-DB verify** (user): process a date range with approved cost sheets (count matches legacy), store the processed sheets, delete-stored (weekly/monthly); confirm audit rows + that counts match a legacy run on the same data
## Phase 7 — Loans  🟡 code complete, pending live-DB verify

- [x] Prisma models: `tblLoanScheme` (CRUD), `tblLoan` (read/delete; PK LoanNo, LoanBalance computed = LoanAmount−RepaidAmount), `tblLoanRepayment` (read/delete), `VwLoan` (list reads)
- [x] SP wrappers in `procedures.ts`: `spAddLoan` (OUTPUT LoanNo; **-19** pending same scheme / **-27** pending any), `spUpdateLoan`, `spApproveLoan`, `spAddLoanRepayment` (**-20** duplicate receipt), `spApproveLoanRepayment` (OUTPUT repaid+balance), `spDeleteLoanRepayment`
- [x] `features/loans/`: `schema.ts` (loan: worker+scheme required, LoanAmount ≥ RepaidAmount; scheme; repayment amount > 0), `queries.ts` (list/active/get/getView/schemes/repayments/outstanding-count/worker-search), `actions.ts` (scheme CRUD, loan create/update/approve/delete, repayment add/approve/delete) with the legacy permission gates (schemes+loans → `loans.manage`; repayments → `loans.repayment`)
- [x] UI: `SchemeManager` (table + add/edit dialog + delete), `LoanTable` (manage/repayment/active modes), `LoanEditor` (Find Worker via reused `WorkerSelectDialog` + outstanding-loan toast, scheme ComboBox, live balance, Approve), `RepaymentPanel` (loan summary + repayments table + add dialog + approve/delete; add gated on approved & balance > 0)
- [x] Pages: `/loans/scheme`, `/loans/manage{,/new,/[loanNo]}`, `/loans/repayment{,/[loanNo]}`, `/loans/last-repayment`; `/loans/report` = placeholder (native rebuild deferred to Phase 8 per ADR-007 revised; legacy deep-linked the external report app)
- [x] `tsc` clean · `vitest` 18/18 · `next build` OK (58 routes)
- [ ] **Live-DB verify** (user): add/edit/delete a scheme; create a loan (LoanNo generated; -19/-27 guards), edit, approve; add a repayment (-20 duplicate receipt), approve (repaid/balance update), delete; confirm active-loan list + audit rows
- Improved over legacy (not blind ports): scheme edit passes the real Id (legacy dropped it → no-op update); loan delete enabled for unapproved loans (legacy `Approved.HasValue` disabled it for all)
## Phase 8 — Reports + Excel/CSV exports  🟡 code complete (engine + Loans + Worker List + Daily/Weekly/Monthly requisition reports)

Native reports replacing the legacy Crystal Reports / `rptlams.gdlcwave.com` deep links (ADR-007 revised). Each legacy `.aspx` report was `SELECT * FROM <view> WHERE <date filter>` rendered by a `.rpt`; rebuilt as a print-CSS page + Excel/CSV export off one engine.

**Report engine (`src/features/reports/`):**
- [x] `types.ts` — `ReportDef` (query + columns + grouping), `ReportColumn` (format/align/total), `ReportParam` (date-range / select); `REPORT_HEADER` company/branch
- [x] `catalog.ts` — PURE client-safe metadata (report key/label/family/permission/params/`live`); mirrors the legacy launcher dropdowns
- [x] `registry.ts` — server-only, binds each key to columns + grouping + `query()` loader; column keys are the views' own PascalCase names
- [x] `queries.ts` — ad-hoc `query()` reads ported verbatim from the legacy `.aspx.cs` (exact SQL/filters/params)
- [x] `format.ts` (+ **9 vitest tests**) — value formatting (money/date/yesno/integer), `sumTotals`, `excelValue`; shared by screen + Excel + CSV
- [x] `params.ts` — resolve declared params from the query string, `dateBounds` (yyyy-mm-dd → inclusive start/end of day, matching legacy 00:00:00/23:59:59), `describeRange` sub-header
- [x] `report-view.tsx` — server-rendered print sheet (company header, single-level grouping, per-group subtotals + record counts, grand total)
- [x] `report-toolbar.tsx` — Print + Excel + CSV (client, `report-no-print`)
- [x] `report-launcher.tsx` — report picker + params → opens `/report/[key]` in a new tab (ports `window.open(url, "_blank")`)
- [x] `excel.ts` (exceljs) + `csv.ts` — export builders (title block, styled header, groups + subtotals + grand total); `exceljs` added to `serverExternalPackages`
- [x] Print CSS in `globals.css` (`.report-sheet/.report-table`, `@media print` hides chrome, `@page` margins)

**Routes:**
- [x] `/report/[key]` — print view (force-dynamic; permission-gated per report)
- [x] `/api/exports/[key]?format=xlsx|csv&…` — streamed download (same registry query + columns as the print view)

**Reports rebuilt (faithful to legacy SQL):**
- [x] **Loan Master** — `vwLoans` where `CreatedDate` in range; grouped by Scheme; totals LoanAmount/Repaid/Balance
- [x] **Loan Repayment Master** + **Daily/Weekly/Monthly/Receipt** — `vwLoanRepayments` where `ApprovedDate` in range AND `Approved=1` (+ `ReqNo LIKE 'D/W/M/R%'` per variant); grouped by Scheme; totals `LoanRepayAmt`
- [x] **Loan Repayment Summary** — SQL-aggregated `SUM(LoanRepayAmt) GROUP BY LoanScheme`; flat + grand total
- [x] **Worker List** — `vwWorkerList` where `WorkerType=@type` (D/W/M selector); grouped by Trade Group with per-group counts
- [x] `/loans/report` wired to the real Loan launcher (was a placeholder); `/reports/worker-list` added
- [x] `REPORT_APP_URL` retired (unused in code; commented out in `.env.example`)
- [x] `tsc` clean · `vitest` 32/32 · `next build` OK (73 routes)

**Requisition reports (continuation — daily/weekly/monthly):**
- [x] Engine extended: `text` param kind (payroll-individual worker id) wired through launcher + params resolver + sub-header
- [x] Generic query builders (`requisition-queries.ts`): `dateRangeView`, `dateRangeViewByWorkerType` (A=all), `dateRangeViewByWorkerField` (reportBy WorkerID/SSFNo, whitelisted)
- [x] `requisition-registry.ts` — **42 report defs** (Daily 15, Weekly 15, Monthly 12) with curated columns + DLE/Bank/Trade-group subtotals; catalog entries added; `/reports/{daily,weekly,monthly}` launchers now live
- [x] Reconciliation test (`registry.test.ts`, mocks `server-only`) — every live catalog entry ↔ a registry report (no drift); `@` alias added to `vitest.config.ts`
- [x] Reports live: **Daily/Weekly** — Active Worker List (+SSF), Active Vessel, Cost Sheet, Approved Cost Sheet, Processed, Invoice, Payroll, Payroll-Individual, Report Listing, Statistics, SSF, Leave & Bonus, PF, Tax. **Monthly** — Approved Cost Sheet, Processed, Invoice, Payroll, Payroll-Individual, Bank Payment, Report Listing, Statistics, SSF, Leave & Bonus, PF, Tax.
- **workerType** filter on Daily Approved Cost Sheet + Daily Payroll (A/D/W/M; A=all — ports the `vwDailyApprovedCostSheet` WHERE branch + `spGetDailyPayroll`). **Payroll-Individual** filters by WorkerID/SSFNo (Monthly reads `vwMonthlyApprovedCostSheet`, matching the legacy quirk). The 3 SP-backed reports (`spGetDailyPayroll`, `spGetMonthlyReportListingByCompany`) are rebuilt as direct view SELECTs (same output, no injection-shaped dynamic SQL).
- **Deferred (no backing DB view exists):** Monthly Active Worker List, Monthly Active Vessel List, Monthly Cost Sheet (the monthly cycle has no per-day roster view; the legacy monthly cost sheet renders via an embedded Crystal report with no queryable view). Listed as disabled in the Monthly launcher.
- [ ] **Live-DB verify** (user): run reports across all families against `bnabdb`; confirm columns/date-filter (`Adate`/`date_`/`TransDate`)/grouping/totals match a legacy run; workerType + payroll-individual filters; export Excel + CSV; print/PDF renders cleanly
- **Grouping/totals + column caveat:** the `.rpt` binaries store field placement in a proprietary compressed stream (unreadable), so column *selection* and grouping are curated from each view's columns + the report's purpose + section-level group count — single-level groups with subtotals + counts. Adjust the registry column list/grouping per report if an exact legacy layout match is needed.

## Post-migration fixes & polish (2026-07-08)

- [x] **BullMQ queue-name bug fixed** — BullMQ v5 forbids `:` in a queue *name*, so `new Queue("tema:email")` threw "Queue name cannot contain :" (the error on `/admin/jobs`, even with Redis up). Names are now `email`/`clms` with the branch (`tema`) as the BullMQ **`prefix`** (Queue + Worker); Redis keys are `tema:email:*` / `tema:clms:*` — same multi-branch isolation. Verified: queues construct without throwing.
- [x] **Email delivery made resilient** — `enqueueEmail` now tries the queue (3s timeout, since ioredis keeps `.add()` pending while Redis is down) and **falls back to an inline `sendMail`** if the queue is unreachable, so account-activation + password-reset emails always go out even without the Worker/Redis. SMTP already matches the legacy `EmailSettings` (host `mail.xcelisolutions.com`, port **8889** STARTTLS/Auto, `noreply@xcelisolutions.com`).
- [x] **Dashboard rebuilt to replicate `LAMS.Server/Index.razor`** — `getOperationalDashboard(from,to,unit)` ports `GetGPHARequests(from,to)` + `GetWorkerStats()` (vwWorkers `WorkerStatus='Active'`). New `OperationalDashboardView` (client): From/To date + Unit filter with an **Apply that re-runs** via searchParams; 6 KPI cards (Total / With CS / Pending CS / GPHA Appr / GDLC Appr / Workers+active); Requests-by-Unit (top 10) + Requests-by-Job (top 8) bar charts; Cost-Sheet donut + Approval pie; Unit Breakdown + Recent-15 tables. Gated on `Dashboard.View`. (Replaces the Phase-9b tile dashboard + old trend chart.)
- [x] **Step-by-step IIS deploy guide** — `docs/IIS-DEPLOYMENT-GUIDE.md` (Node/IIS/Memurai install, `.env` with `$`-escaping, standalone build + asset copy, seed, NSSM services for Web + Worker, ARR/URL-Rewrite reverse-proxy `web.config`, email behaviour, CLMS cutover, redeploy, troubleshooting). `DEPLOYMENT.md` links to it.
- [x] **Background services verified live** — connected `npm run worker` to the real remote Redis (`18.169.234.184:6379`); confirmed via `getJobCounts()` and live TCP connections. Two bugs found + fixed along the way:
  1. The queue-name fix above (this was the actual `/admin/jobs` error).
  2. **`REDIS_URL` was malformed** (`"redis:Rds$2_5#Xcel@1*2^3@18.169.234.184:6379"` — missing `//` after `redis:`). Since `redis` isn't a URL "special scheme", `new URL()` doesn't throw on this — it silently parses an **empty hostname**, so BullMQ fell back to `localhost`/`::1` (`ECONNREFUSED`) with no indication the URL itself was the problem. `src/jobs/connection.ts` now prefers discrete `REDIS_HOST`/`REDIS_PORT`/`REDIS_USERNAME`/`REDIS_PASSWORD` vars (same pattern as `MSSQL_*` vs `DATABASE_URL`) so a password with `@ # $ ^` never has to survive both dotenv-expand *and* URL percent-encoding at once; falls back to `REDIS_URL` parsing if `REDIS_HOST` isn't set. `.env` updated to the discrete form; `.env.example` documents both.
- [x] `tsc` clean · `vitest` 32/32 · `next build` OK
- **Heads up:** the live Redis reports version **5.0.14.1** — BullMQ recommends 6.2.0+. Basic ops (`getJobCounts`, add/process) worked fine in this check; flag to whoever manages that instance if anything BullMQ-specific misbehaves later.

## Phase 9 — Admin (users, permission panel, audit viewer, jobs dashboard)  🟡 code complete, pending live-DB + Redis verify

- [x] `user-repository` extended: `listUsers` (+ roles per user), `listRoles`, `setUserRoles` (diff add/remove in AspNetUserRoles), `setUserEnabled` (LockoutEnd + **rotates SecurityStamp** so live sessions die), `addPermissionClaim`/`removePermissionClaim` (AspNetUserClaims, ClaimType="Permission")
- [x] `permission-service` extended: `grantPermission`/`revokePermission`/`resetPermission` — same claim semantics as LAMS.Server (grant drops revoke+adds grant; revoke drops grant+adds revoke; reset drops both) + cache invalidation
- [x] `features/admin/`: `queries.ts` (users, user detail w/ role+permission-status, audit-trail top-1000 join AspNetUsers, BullMQ job snapshot), `actions.ts` (saveUserRoles, toggleUserEnabled, setPermission grant/revoke/reset, triggerReconcile, retryFailedJobs, cleanCompletedJobs) — user ops gated `admin.users`, job ops gated `admin.hangfire`
- [x] UI: `UserList` (DataTable + enable/disable + manage link), `UserPermissions` (role checkboxes + grouped permission grid with source icons role/grant/revoke/none + grant/revoke/restore/remove-grant), `AuditTrailViewer` (DataTable client search), `JobsDashboard` (per-queue counts + failed-jobs table + run-reconcile/retry/clean; degrades gracefully when Redis is down)
- [x] Pages: `/admin/users`, `/admin/users/[userId]`, `/admin/audit-trail`, `/admin/jobs` (nav links already existed)
- [x] `tsc` clean · `vitest` 18/18 · `next build` OK (62 routes)
- [ ] **Live-DB + Redis verify** (user): change a user's roles + grant/revoke/reset a permission (confirm effective set shifts within the 15-min cache window in *both* apps via shared claims); disable/enable a user (session dies via stamp); browse audit trail; run/retry jobs on `/admin/jobs`
- **Bull Board decision:** replaced by a native, auth-gated jobs dashboard rather than mounting `@bull-board/express` — App-Router-friendly, reuses our `admin.hangfire` gate (fixing the legacy any-authenticated-user hole), no extra Express server. Recorded against ADR-005.
- Deferred (faithful): "Add New User" (create-user/registration) — the seed script provisions users; Identity self-service account pages remain parked (2FA etc.)
## Phase 9b — Accounts, self-service & operational dashboard  🟡 code complete, pending live-DB + SMTP verify

- [x] Stateless signed action tokens (`server/auth/action-token.ts`, HMAC over `AUTH_SECRET`, bound to SecurityStamp → single-use) — **no schema change** (no reset-token table)
- [x] `user-repository` + `permission-service` extended: `createUser` (PasswordHash NULL, EmailConfirmed 0), `emailExists`/`userKeyExists`, `updateUserName`, `setPassword`/`setPasswordAndConfirm` (rotate stamp)
- [x] `features/account/`: actions (`adminCreateUser` + activation email; `requestPasswordReset` — never leaks existence; `activateAccount`; `resetPassword`; `updateProfile`; `changePassword` — verifies current password) + forms
- [x] Activation email template (`emails/templates.ts`) enqueued via the Phase-4 email queue; links use `AUTH_URL`
- [x] Admin **Add New User** → `/admin/users/new` (create + send activation); button added to the user list
- [x] Auth pages: real `/forgot-password`, `/activate?token=`, `/reset-password?token=`
- [x] Self-service (dashboard shell): `/account` (edit name), `/account/password` (change password); topbar name links to `/account`
- [x] **Operational dashboard** (`/`): GPHA tiles (pending / awaiting GPHA / awaiting GDLC / reconcile backlog), req-unapproved (daily/weekly/monthly), active loans + outstanding balance; 7-day GPHA trend bar chart (recharts); recent GPHA table (gated on `clms.view`); tiles deep-link
- [x] `tsc` clean · `vitest` 18/18 · `next build` OK (67 routes)
- [ ] **Live verify** (user): admin creates a user → activation email arrives → set password → login; forgot→reset round-trip; edit profile; change password; dashboard numbers match the DB
- Deferred (parked): 2FA, external logins, ClientPortal, email-change re-confirmation

## Phase 10 — Cutover (GPHA endpoint swap, disable legacy Hangfire job)  🟢 runbook written (ops action, not code)

- [x] **`docs/CUTOVER.md`** — pre-cutover checklist; GPHA endpoint swap (byte-compatible legacy paths already aliased; enable `CLMS_SHARED_SECRET` header at swap); **disable the legacy Hangfire `ProcessGPHAPendingApprovedRequests_tema` recurring job** (avoid double-push — one scheduler per branch); parallel-run DB-state parity sign-off; decommission; low-risk rollback (no schema change)
- [ ] **Execute** (ops, when scheduled): perform the swap, disable the legacy job, run the 2-week parallel sign-off

## Decisions (answered)

1. ✅ **Production DB: `bnabdb`** — configured in `.env` (Prisma `DATABASE_URL` + `MSSQL_*`).
2. ✅ **Hosting: Windows / IIS** — Next.js standalone as a Windows Service behind an IIS reverse proxy; Redis via Memurai; worker as a second service. See `DEPLOYMENT.md` (ADR-005 updated).
3. ✅ **2FA and ClientPortal pages: skipped** for now (not built; parked).

4. ✅ **CLMS inbound caller** — an **external service** posts to the endpoints. Phase 4 hardens them with the `CLMS_SHARED_SECRET` header (+ payload validation, integration log).
5. ✅ **Reports** — we build our **own native reports**; do NOT depend on `rptlams.gdlcwave.com`. Supersedes ADR-007 Phase-1 deep-linking: report pages render in-app (print CSS / PDF). `REPORT_APP_URL` is retired once each report is rebuilt.
