# Deployment — Windows / IIS

> **For a follow-along, numbered walkthrough** (install Node/IIS/Memurai, build,
> NSSM services, IIS proxy config, email, troubleshooting) see
> **[IIS-DEPLOYMENT-GUIDE.md](./IIS-DEPLOYMENT-GUIDE.md)**. This file is the
> architecture/topology reference.

Target: **Windows Server with IIS** (confirmed). Next.js is a Node app, so IIS
acts as a TLS-terminating reverse proxy in front of a standalone Node process
run as a Windows Service — do **not** try to host Next.js 15 under `iisnode`
(unmaintained, and incompatible with the App Router server runtime).

## Topology

```
                         ┌─────────────────────────────────────────┐
  Internet / LAN ──TLS──▶│ IIS (ARR + URL Rewrite reverse proxy)    │
                         │   https://lams.gdlc… → http://127.0.0.1:3000
                         └───────────────┬─────────────────────────┘
                                         │
                 ┌───────────────────────┼──────────────────────────┐
                 ▼                       ▼                          ▼
        Next.js app (Service)   BullMQ worker (Service)        Memurai
        node server.js          node worker (Phase 4)      (Redis for Windows)
        port 3000                                               port 6379
                 │                       │
                 └───────── SQL Server (bnabdb) ─────────┘   ← existing, shared
```

## 1. Build artifact (standalone)

`next.config.ts` sets `output: "standalone"`. `next build` produces
`.next/standalone` (a self-contained server + minimal `node_modules`).

Deploy these to the server:
- `.next/standalone/`  → contains `server.js`
- `.next/static/`      → copy to `.next/standalone/.next/static`
- `public/`            → copy to `.next/standalone/public`
- `prisma/`            → schema + generated client (run `prisma generate` in CI)
- `.env`               → production values (NOT committed)

Start command: `node server.js` (listens on `PORT`, default 3000).

## 2. Run as a Windows Service

Use **NSSM** (simplest) or **node-windows**/PM2 to run `node server.js` as a
service so it survives reboots and restarts on crash.

```powershell
# Example with NSSM
nssm install LAMS-Web "C:\Program Files\nodejs\node.exe" "C:\lams\standalone\server.js"
nssm set LAMS-Web AppDirectory "C:\lams\standalone"
nssm set LAMS-Web AppEnvironmentExtra PORT=3000 NODE_ENV=production
nssm start LAMS-Web
```

Env vars: set them in the service config (`AppEnvironmentExtra`) or ship a
production `.env` next to `server.js` (loaded by the app). Never commit `.env`.

## 3. IIS reverse proxy

Install **Application Request Routing (ARR)** + **URL Rewrite**. Create a site
bound to the public hostname with the TLS certificate, and a reverse-proxy rule:

- Inbound rule: `(.*)` → `http://127.0.0.1:3000/{R:1}`
- Enable proxy in ARR; forward the original `Host` header.
- Set `AUTH_URL` to the public HTTPS URL. `trustHost` is already enabled in
  `auth.config.ts` so proxied host/proto headers are honoured.

**Cutover note (Phase 10):** the GPHA CLMS inbound endpoints
(`/api/clms/labour-request`, `/api/clms/cost-sheet`) must answer at the same
host/path GPHA already posts to. Do the swap at this IIS layer so GPHA's
configuration doesn't change.

## 4. Redis (for BullMQ — Phase 4)

Official Redis has no supported Windows build. Options, best first:
1. **Memurai** — native Redis-compatible Windows service (recommended for a
   pure-Windows box). Install, runs on `localhost:6379`.
2. Redis in **WSL2** or **Docker Desktop** if either is available on the server.

Set `REDIS_URL` accordingly. Not needed until Phase 4.

## 5. Background worker (Phase 4)

The BullMQ worker (`npm run worker` → a compiled entrypoint) runs as a **second
Windows Service**, replacing the legacy Hangfire recurring job. It hosts the
CLMS reconciliation cron (`*/10 * * * *`, queue = `BRANCH_QUEUE`) and the email
queue. **At cutover, disable the legacy Hangfire job** so hours aren't
double-pushed.

## 6. Database

- Existing shared **`bnabdb`** on SQL Server — no schema changes. The app is a
  client only. Ensure the service account/connection user has EXECUTE on the
  stored procedures and SELECT/INSERT/UPDATE on the tables it touches.
- `DATABASE_URL` (Prisma) + `MSSQL_*` (node-mssql) both point at `bnabdb`.

## 7. First-run checklist on the server

```powershell
npm ci
npx prisma generate
npm run build
# copy standalone artifact into place (see §1)
npm run seed          # ensure roles + admin users exist in bnabdb
# install + start the LAMS-Web service, configure IIS proxy
```

## Node & TLS

- Node LTS (v20+; dev is on v24). Install as machine-wide, referenced by the
  service.
- TLS terminates at IIS; the Node process listens on loopback only (bind 127.0.0.1).
