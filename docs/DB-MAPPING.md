# Database Mapping

Maps legacy DB objects to their Next.js access path. **The database is
authoritative and shared — no schema changes, ever.** Prisma is for CRUD;
node-mssql is for stored procedures (which return data via OUTPUT params and
RETURN values that Prisma can't capture).

## Access strategy

| Object type | Access | Where |
|---|---|---|
| `Tbl*` CRUD tables | Prisma (`prisma db pull` introspected) | `src/db/prisma.ts` |
| `Vw*` views | Prisma (read-only models) | `src/db/prisma.ts` |
| Stored procedures | node-mssql typed wrapper | `src/db/procedures.ts` via `callProcedure` |
| ASP.NET Identity tables | node-mssql (auth), Prisma later | `src/server/repositories/user-repository.ts` |

### The stored-procedure wrapper

`callProcedure(name, { inputs, outputs })` returns `{ rows, recordsets, output,
returnValue, rowsAffected }` — so a legacy `(int ReturnValue, string LoanNo)`
tuple becomes named fields. Add one typed function per SP in `procedures.ts` as
each module is migrated; never call SQL from route handlers or components.

## Mapped so far (Phase 0)

| DB object | Type | Next.js wrapper |
|---|---|---|
| `AspNetUsers` | table | `user-repository.findUserByEmail/ById`, `getSecurityStamp`, `updatePasswordHash` |
| `AspNetRoles` + `AspNetUserRoles` | tables | `user-repository.getUserRoles` |
| `AspNetUserClaims` | table | `user-repository.getUserPermissionClaims` |
| `tblAuditTrail` | table | written via `spAddAuditTrail` |
| `spAddAuditTrail(@actiondate,@actionby,@actiondescription,@actionid)` | SP | `procedures.spAddAuditTrail` → `audit/audit-log.ts` |
| `aaspAddAuditTrailDelete` (OUTPUT `@actionlogged` + RETURN) | SP | `procedures.aaspAddAuditTrailDelete` (demonstrates the OUTPUT/RETURN pattern; ports `isLogged`) |

## Mapped so far (Phase 4 — CLMS / GPHA)

| DB object | Type | Next.js access |
|---|---|---|
| `GPHALabourRequests` | table | Prisma `gPHALabourRequests` — inbound insert (idempotent on Id); insert fires `trg_Insert_GPHALabourRequests` → `tblGPHA_LabourRequests` |
| `GPHAJobAssignments` | table | Prisma `gPHAJobAssignments` — inbound insert + reconcile source (`Processed = 0`) + mark-processed |
| `GPHACostSheets` | table | Prisma `gPHACostSheets` — inbound insert |
| `GPHACostSheetDetails` | table | Prisma `gPHACostSheetDetails` — inbound insert + reconcile per-worker hours |
| `tblGPHA_LabourRequests` | table | Prisma `tblGphaLabourRequest` — reconcile read/update; list reads via mssql `query()` (join `tblStaffReq`) |
| `spAddDailyReq_GPHARequest` (RETURN 0 / **-23**) | SP | `procedures.spAddDailyReqGphaRequest` → `features/clms/actions.createCostSheetFromRequest` |
| `tblStaffReq` (reconcile header update) | table | Prisma `tblStaffReq.update` (Normal/Overtime/GPHA_RequestID/ShiftType) |
| `tblSubStaffReq` (AddGPHASubStaff, insert-if-absent) | table | Prisma `tblSubStaffReq.findFirst` + `create` |

Reconciliation + inbound live in `src/server/integrations/clms/`; jobs in `src/jobs/`
(BullMQ), email in `src/server/email/`. See `MIGRATION-CHECKLIST.md` Phase 4.

## Mapped so far (Phase 6 — Payroll process/store)

All share `@startdate/@enddate` + a "by" param + an OUTPUT count + RETURN value;
wrapped once by `runPayroll()` in `procedures.ts` (→ `features/payroll/actions.runPayrollOp`).

| SP | "by" param | count OUTPUT |
|---|---|---|
| `spProcessDailyReq` / `spProcessWeeklyReq` / `spProcessMonthlyReq` | `@processedby` | `@processedCostSheets` |
| `spStoreDailyReq` / `spStoreWeeklyReq` / `spStoreMonthlyReq` | `@storedby` | `@storedCostSheets` |
| `spDeleteStoredWeeklyReq` / `spDeleteStoredMonthlyReq` (no daily) | `@deletedby` | `@deletedstoredCostSheets` |

## Mapped so far (Phase 7 — Loans)

| DB object | Type | Next.js access |
|---|---|---|
| `tblLoanSchemes` | table | Prisma `tblLoanScheme` — scheme CRUD |
| `tblLoans` | table | Prisma `tblLoan` — edit read + delete (LoanBalance computed) |
| `tblLoanRepayments` | table | Prisma `tblLoanRepayment` — repayment list read |
| `vwLoans` | view | Prisma `VwLoan` — loan list / active-loan / repayment-panel reads |
| `spAddLoan` (OUT LoanNo; 0 / **-19** / **-27**) | SP | `procedures.spAddLoan` |
| `spUpdateLoan` / `spApproveLoan` | SP | `procedures.spUpdateLoan` / `spApproveLoan` |
| `spAddLoanRepayment` (0 / **-20**) | SP | `procedures.spAddLoanRepayment` |
| `spApproveLoanRepayment` (OUT repaid+balance) | SP | `procedures.spApproveLoanRepayment` |
| `spDeleteLoanRepayment` | SP | `procedures.spDeleteLoanRepayment` |

## Mapped so far (Phase 8 — Reports)

Read-only report views, accessed via the `query()` mssql helper in
`features/reports/queries.ts` (ad-hoc SELECTs, not CRUD/SPs). Row keys are the
views' own PascalCase columns; SQL is ported verbatim from the legacy
`.aspx.cs` report loaders.

| DB object | Type | Next.js access | Legacy filter |
|---|---|---|---|
| `vwLoans` | view | `reports/queries.loanMaster` | `CreatedDate BETWEEN @st AND @ed` |
| `vwLoanRepayments` | view | `reports/queries.loanRepayments` (+ ReqNo prefix), `loanRepaymentSummary` (SUM GROUP BY LoanScheme) | `ApprovedDate BETWEEN @st AND @ed AND Approved=1` (+ `ReqNo LIKE 'D/W/M/R%'`) |
| `vwWorkerList` | view | `reports/queries.workerList` | `WorkerType=@type` (D/W/M) |

`vwLoans` is also a Prisma model (`VwLoan`) used for the loan-management UI; the
reports read it via raw `query()` so the SELECT matches the legacy report exactly.
`vwLoanRepayments` / `vwWorkerList` are report-only (no Prisma model added — no
schema change).

**Requisition report views** (continuation) — all read via `query()` in
`features/reports/requisition-queries.ts`, filtered on `Adate` (Approved/Stored)
or `date_` (General; weekly active-vessel uses `TransDate`):

| Family | Views |
|---|---|
| Daily General | `vwDailyActiveWorkers`, `vwDailyActiveVessel`, `vwDailyCostSheet` |
| Daily Approved | `vwDailyApprovedCostSheet` (workerType), `vwDailyProcessed`, `vwDailyInvoice`, `vwDailyPayroll` (workerType + individual), `vwDailyReportListing`, `vwDailyStatistics` |
| Daily Stored | `vwDailySSF`, `vwDailyLeaveBonus`, `vwDailyPF`, `vwDailyTax` |
| Weekly | `vwWeeklyActiveWorkers`, `vwWeeklyActiveVessel`, `vwWeeklyCostSheet`, `vwWeeklyApprovedCostSheet`, `vwWeeklyProcessed`, `vwWeeklyInvoice`, `vwWeeklyPayroll`, `vwWeeklyReportListing`, `vwWeeklyStatistics`, `vwWeeklySSF`, `vwWeeklyLeaveBonus`, `vwWeeklyPF`, `vwWeeklyTax` |
| Monthly | `vwMonthlyApprovedCostSheet` (also backs Monthly Payroll-Individual), `vwMonthlyProcessed`, `vwMonthlyInvoice`, `vwMonthlyPayroll`, `vwMonthlyBankPayment`, `vwMonthlyReportListing`, `vwMonthlyStatistics`, `vwMonthlySSF`, `vwMonthlyLeaveBonus`, `vwMonthlyPF`, `vwMonthlyTax` |

Legacy SP-backed reports (`spGetDailyPayroll`, `spGetMonthlyReportListingByCompany`)
are rebuilt as direct view SELECTs (the SPs only wrap a `SELECT * FROM <view>` with
a date/workerType filter). No monthly active-worker/vessel/cost-sheet view exists,
so those reports remain unavailable. All report-only (no Prisma models, no schema change).

## Mapped so far (Phase 9 — Admin)

| DB object | Type | Next.js access |
|---|---|---|
| `AspNetUsers` (list / enable-disable) | table | `user-repository.listUsers`, `setUserEnabled` (LockoutEnd + SecurityStamp rotate) |
| `AspNetRoles` / `AspNetUserRoles` | tables | `user-repository.listRoles`, `setUserRoles` (diff) |
| `AspNetUserClaims` (Permission overrides) | table | `user-repository.addPermissionClaim`/`removePermissionClaim` → `permission-service.grant/revoke/resetPermission` |
| `tblAuditTrail` (read, join AspNetUsers) | table | `features/admin/queries.searchAuditTrail` |
| BullMQ queues (`tema:clms` / `tema:email`) | Redis | `features/admin/queries.getJobsSnapshot` + `actions` (trigger/retry/clean) |

## To map (upcoming phases — from the repository interfaces)

Each interface in `BusinessLogic/Repository/IRepository` is a behaviour contract
whose SP calls must be wrapped here:

- **Setups (F1):** `ISetupRepository` — Gang/Bank/BankBranch/Nationality/Cargo/
  Vessel/Location/DLECompany CRUD (mostly plain statements, a few SPs).
- **Workers (F2/F3):** `IWorkerRepository` — `AddWorker` (returns AutoNo,
  ReturnValue, GPHAGroupId, GPHAJobId), trade groups/types/rates, payroll setup.
- **Daily (F4):** `IDailyReqRepository` — `AddDailyReq` (AutoNo/ReturnValue),
  `ProcessDailyReq`/`StoreDailyReq` (costSheets/returnValue), GPHA hours methods.
- **CLMS (F5):** raw inserts into `GPHALabourRequests`, `GPHAJobAssignments`,
  `GPHACostSheets`, `GPHACostSheetDetails`; reconciliation SPs.
- **Weekly/Monthly (F6):** `IWeeklyReqRepository`, `IMonthlyReqRepository` —
  work-days, confirm, duplicate-shift, process/store/delete-stored.
- **Approvals (F7):** approve/disapprove SPs across the `TblApprove*` /
  `TblDisapprove*` / `TblStored*` state-machine tables.
- **Loans (F9):** `ILoanRepository` — `AddLoan` (ReturnValue, LoanNo),
  `ApproveLoanRepayment` (LoanRepaidAmount, LoanBalance, ReturnValue).

## Introspection

`npm run db:pull` regenerates `prisma/schema.prisma` from the live DB. It
overwrites hand-written models — reconcile model names with code afterward
(introspection names models after tables, e.g. `AspNetUsers`, `tblGang`). The
hand-written Identity/audit models exist so the app is usable before the first
pull; auth does not depend on them.
