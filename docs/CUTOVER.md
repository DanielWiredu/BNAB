# Phase 10 — Cutover Runbook

Strangler-fig cutover from **LAMS.Server (Blazor)** to **bnab (Next.js)** against
the **same shared database**. The new app has run module-by-module alongside the
legacy app; this is the final switch. Cutover is an operations task — this doc is
the runbook, not code.

See `DEPLOYMENT.md` for how the app + worker + Redis are hosted (Windows/IIS).

---

## 0. Pre-cutover checklist

- [ ] `bnab` deployed (standalone Next.js) and reachable behind the reverse proxy.
- [ ] Worker service running (`npm run worker`) with Redis/Memurai up.
- [ ] `.env` finalised: real `DATABASE_URL`/`MSSQL_*`, `AUTH_SECRET`, `AUTH_URL`
      (the canonical public URL — used in activation/reset email links),
      `SMTP_*`, `REDIS_URL`, `BRANCH_QUEUE=tema`, `CLMS_SHARED_SECRET`.
- [ ] `npm run db:check` passes against the production DB.
- [ ] Exposed git-history credentials (DB, SMTP) **rotated**.
- [ ] Login smoke test with a real account; sidebar renders per-permission.
- [ ] A test activation email + password-reset email actually deliver.

## 1. GPHA CLMS endpoint swap

The inbound endpoints are **byte-compatible** with the legacy controller and are
mounted at BOTH the canonical and legacy paths:

| Legacy path (keep working) | Canonical path |
|---|---|
| `POST /api/GHPACLMS/CreateLabourRequest` | `POST /api/clms/labour-request` |
| `POST /api/GHPACLMS/CreateCostSheet` | `POST /api/clms/cost-sheet` |

Cutover options (pick one):
- **Preferred — host/proxy swap:** repoint the existing GPHA-facing hostname/route
  at the reverse proxy so the URL GPHA already POSTs to now resolves to bnab. No
  change on GPHA's side.
- **DNS swap:** if GPHA targets a dedicated hostname, point it at the new host.

Hardening at swap time:
- [ ] Set `CLMS_SHARED_SECRET` and coordinate with GPHA to send it as the
      `x-clms-secret` header. (Until both sides are set, the header is not
      enforced — see `server/integrations/clms/auth.ts` — so the feed keeps
      flowing; enable enforcement once GPHA sends the header.)
- [ ] Optionally set `CLMS_COMPANY_KEY` / `CLMS_COMPANY_SECRET` to also verify the
      payload's company credentials.
- [ ] Keep the legacy endpoint alive **read-only** for ~2 weeks as a fallback.

## 2. Disable the legacy Hangfire reconciliation job  ⚠ CRITICAL

Two reconcilers running against the same DB will double-push hours (the SP guards
`staffReq.Approved` / `Normal == 0` are a backstop, **not** the mechanism —
don't rely on them).

- [ ] In **AppMain/LAMS.Server**, stop the recurring job
      `ProcessGPHAPendingApprovedRequests_tema` (Hangfire dashboard → Recurring →
      delete/disable), and stop calling `UtilitiesController.InitiateGPHAPendingApprovedRequests`.
- [ ] Confirm the bnab worker's repeatable job `clms-reconcile` on queue
      `tema:clms` is registered and running (visible on `/admin/jobs`).
- [ ] Rule: exactly **one** scheduler enabled per branch queue at any time.

## 3. Parallel-run sign-off (≈2 weeks)

- [ ] Both apps point at the same DB; users transition to bnab.
- [ ] Spot-check DB-state parity after identical operations (requisitions,
      approvals, payroll process/store, loans) — the legacy app has no tests, so
      parity is verified by diffing DB state, not by unit tests.
- [ ] Watch the worker logs + `/admin/jobs` for failed jobs; watch inbound CLMS
      logs (structured pino `clms.inbound.*`) for dropped payloads.

## 4. Decommission

- [ ] Retire the LAMS.Server UI (keep the inbound endpoint read-only until the
      fallback window closes).
- [ ] Per-report: as each native report is rebuilt (Phase 8), retire that
      `REPORT_APP_URL` deep link.

## 5. Rollback

- Cutover touches **no schema** and adds no destructive migration, so rollback is
  low-risk:
  - Re-point the GPHA hostname/route back at LAMS.Server.
  - Re-enable the legacy Hangfire recurring job; stop the bnab worker.
  - Both apps read the same DB, so no data reconciliation is needed on rollback.

## Notes / non-goals

- 2FA, external logins and the ClientPortal pages are **parked** (not migrated).
- Reports (Phase 8) may still deep-link the legacy report app until rebuilt.
