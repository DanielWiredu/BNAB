# Step-by-step: Deploy GDLC LAMS (Next.js) to Windows / IIS

A follow-along guide for deploying the app to a Windows Server behind IIS. The
app is a Node.js (Next.js 15) server; **IIS is only a TLS-terminating reverse
proxy** in front of it. There are **two** long-running processes:

| Process | What | Runs as |
|---|---|---|
| **Web** | the Next.js server (`node server.js`) on `127.0.0.1:3000` | Windows Service |
| **Worker** | BullMQ background jobs (emails + CLMS reconcile) | Windows Service |

Plus **Memurai** (Redis for Windows) for the worker, and the existing shared
**SQL Server `bnabdb`** (no schema changes).

> If you only need email + no CLMS auto-reconcile, the Worker + Memurai are
> optional — the app sends activation/reset emails inline when the queue is
> unavailable (see §9). Install them when you want retries + the reconcile cron.

Assume the deploy folder is `C:\lams`. Adjust paths to taste.

---

## 0. Prerequisites (install once on the server)

1. **Node.js LTS v20+** (machine-wide): <https://nodejs.org> → verify `node -v`.
2. **IIS** with these features (Server Manager → Add Roles/Features → Web Server):
   - Web Server (IIS), including *Common HTTP Features*.
3. **IIS URL Rewrite** module — <https://www.iis.net/downloads/microsoft/url-rewrite>
4. **IIS Application Request Routing (ARR)** — <https://www.iis.net/downloads/microsoft/application-request-routing>
5. **NSSM** (runs Node as a service) — <https://nssm.cc/download> → put `nssm.exe` on `PATH` or in `C:\lams\tools`.
6. **Memurai** (Redis-compatible Windows service) — <https://www.memurai.com/get-memurai> (needed for the Worker; §6).
7. Network access from the server to SQL Server `50.28.86.249\SQLEXPRESS` (port 1433 / SQL Browser UDP 1434 for the named instance).

---

## 1. Get the code onto the server

Copy the repo (or `git clone`) to `C:\lams\app`. From that folder:

```powershell
cd C:\lams\app
npm ci
```

## 2. Create the production `.env`

Create `C:\lams\app\.env` (never commit it). Use the values from the legacy
`LAMS.Server/appsettings.json`:

```dotenv
# --- Auth ---
AUTH_SECRET="<run: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\">"
AUTH_URL="https://lams.yourdomain.com"          # the PUBLIC https URL (IIS site)
NODE_ENV="production"
PORT="3000"

# --- Database (bnabdb) ---
# NOTE: the password contains `$` — escape each as \$ so dotenv doesn't treat it
# as a variable. Prisma named instance uses a SINGLE backslash.
DATABASE_URL="sqlserver://50.28.86.249\SQLEXPRESS;database=bnabdb;user=xceldev;password=bT\$h@1J}C6A(U>H%;encrypt=true;trustServerCertificate=true"
MSSQL_SERVER="50.28.86.249"
MSSQL_INSTANCE="SQLEXPRESS"
MSSQL_DATABASE="bnabdb"
MSSQL_USER="xceldev"
MSSQL_PASSWORD="bT\$h@1J}C6A(U>H%"
MSSQL_ENCRYPT="true"
MSSQL_TRUST_SERVER_CERT="true"

# --- Email (from EmailSettings; SMTP port 8889, STARTTLS/Auto) ---
SMTP_HOST="mail.xcelisolutions.com"
SMTP_PORT="8889"
SMTP_USER="noreply@xcelisolutions.com"
SMTP_PASSWORD="NOP25#Xcel@1234"
SMTP_SENDER_NAME="GDLC LAMS"

# --- Background jobs ---
# Local Memurai with no password: a plain REDIS_URL is fine.
REDIS_URL="redis://localhost:6379"
# Remote/managed Redis with a password: use discrete vars instead — a password
# containing @ # $ ^ needs BOTH percent-encoding AND dotenv \$ -escaping inside
# a single REDIS_URL, and "redis:" without "//" silently parses to an EMPTY
# host (see §12). Setting REDIS_HOST switches connection.ts to this form:
# REDIS_HOST="your-redis-host"
# REDIS_PORT="6379"
# REDIS_PASSWORD="the-raw-password-no-encoding-needed-except-\$"
BRANCH_QUEUE="tema"

# --- Seeding ---
SEED_ADMIN_EMAILS="danielwiredu@gmail.com"
```

Verify DB + config load before going further:

```powershell
npm run db:check      # confirms mssql + Prisma connectivity against bnabdb
```

## 3. Generate the Prisma client & build

```powershell
npx prisma generate
npm run build
```

> **Windows gotcha:** if `prisma generate` fails with `EPERM: rename`, the query
> engine DLL is locked by a running dev server or Web service — stop it first,
> then re-run.

`npm run build` produces `.next/standalone/` (a self-contained server).

## 4. Assemble the standalone artifact

The standalone output needs the static assets and `public/` copied in:

```powershell
# from C:\lams\app
robocopy ".next\static" ".next\standalone\.next\static" /E
robocopy "public" ".next\standalone\public" /E
copy ".env" ".next\standalone\.env"
```

The runnable server is now `C:\lams\app\.next\standalone\server.js`.

> Prisma: the generated client is bundled by the standalone tracer. If the app
> can't find the query engine at runtime, copy `node_modules\.prisma` and
> `node_modules\@prisma\client` into `.next\standalone\node_modules\` as well.

## 5. Seed roles + admin users (first deploy only)

```powershell
cd C:\lams\app
npm run seed          # creates roles + the SEED_ADMIN_EMAILS admin(s)
```

## 6. Install Memurai (Redis) — for the Worker

Install Memurai (it registers its own Windows service on `localhost:6379`).
Confirm it's up:

```powershell
Get-Service Memurai            # should be Running
# optional: memurai-cli ping   → PONG
```

## 7. Register the two Windows Services (NSSM)

**Web service** (the Next.js server):

```powershell
nssm install LAMS-Web "C:\Program Files\nodejs\node.exe" "C:\lams\app\.next\standalone\server.js"
nssm set LAMS-Web AppDirectory "C:\lams\app\.next\standalone"
nssm set LAMS-Web AppEnvironmentExtra PORT=3000 NODE_ENV=production HOSTNAME=127.0.0.1
nssm set LAMS-Web AppStdout "C:\lams\logs\web.out.log"
nssm set LAMS-Web AppStderr "C:\lams\logs\web.err.log"
nssm start LAMS-Web
```

**Worker service** (BullMQ — emails + CLMS reconcile). It runs from the full
project via `tsx`, not the standalone bundle:

```powershell
nssm install LAMS-Worker "C:\Program Files\nodejs\node.exe" "C:\lams\app\node_modules\tsx\dist\cli.mjs" "src\jobs\worker.ts"
nssm set LAMS-Worker AppDirectory "C:\lams\app"
nssm set LAMS-Worker AppEnvironmentExtra NODE_ENV=production
nssm set LAMS-Worker AppStdout "C:\lams\logs\worker.out.log"
nssm set LAMS-Worker AppStderr "C:\lams\logs\worker.err.log"
nssm start LAMS-Worker
```

Confirm the web process answers locally:

```powershell
curl http://127.0.0.1:3000/login   # should return HTML (200)
```

## 8. Configure IIS as the HTTPS reverse proxy

1. **Enable the ARR proxy** (once): IIS Manager → server node → *Application
   Request Routing Cache* → *Server Proxy Settings* → check **Enable proxy** → Apply.
2. **Create the site**: IIS Manager → *Sites* → *Add Website*
   - Site name: `LAMS`
   - Physical path: `C:\lams\site` (empty folder — content is proxied)
   - Binding: **https**, your hostname (`lams.yourdomain.com`), and select the TLS certificate.
3. **Add the reverse-proxy rewrite rule.** Put this `web.config` in `C:\lams\site`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <!-- allow larger CLMS payloads + report exports -->
        <requestLimits maxAllowedContentLength="52428800" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

4. **Forward the host header** so Auth.js builds correct callback URLs: ARR →
   *Server Proxy Settings* → check **Preserve client IP in the following header:
   X-Forwarded-For** and leave *Reverse rewrite host in response headers* off.
   `AUTH_URL` in `.env` must equal the public HTTPS URL, and `trustHost` is
   already enabled in `auth.config.ts`.

Browse to `https://lams.yourdomain.com/login` — you should get the app.

## 9. Email — how it sends

Activation + password-reset emails go through the BullMQ queue **when the Worker
+ Memurai are running** (with retries/backoff). If the queue is unreachable, the
app **falls back to sending inline** on the request (bounded by a 3s enqueue
timeout) so mail is never silently dropped. So:

- Worker + Memurai running → queued + retried (best).
- Worker/Memurai down → still sent inline, just without retries.

Test: Admin → Users → *Add New User* → the activation email should arrive. If
not, check `C:\lams\logs\worker.err.log` and the SMTP creds in `.env`.

## 10. CLMS cutover (Phase 10 — when going live)

- GPHA already posts to the legacy `GHPACLMS` path — the app answers at the
  byte-compatible aliases `/api/GHPACLMS/CreateLabourRequest` and
  `/CreateCostSheet`. Point GPHA (or the IIS host) at this server.
- Set `CLMS_SHARED_SECRET` in `.env` and configure GPHA to send the
  `x-clms-secret` header (optional hardening).
- **Disable the legacy Hangfire recurring job `ProcessGPHAPendingApprovedRequests_tema`**
  so hours aren't double-pushed (this app's Worker now owns that reconcile). See
  `docs/CUTOVER.md`.

## 11. Updating the app (redeploys)

```powershell
cd C:\lams\app
git pull                     # or copy new files
npm ci
nssm stop LAMS-Web           # release the Prisma DLL lock before generate
npx prisma generate
npm run build
robocopy ".next\static" ".next\standalone\.next\static" /E
robocopy "public" ".next\standalone\public" /E
copy ".env" ".next\standalone\.env"
nssm restart LAMS-Web
nssm restart LAMS-Worker
```

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Login failed for user 'xceldev'` | `$` in the password not escaped — use `\$` in `.env`. |
| Prisma `Invalid instance name` | Use a **single** backslash: `50.28.86.249\SQLEXPRESS`. |
| `prisma generate` → `EPERM: rename` | Web service/dev server holds the DLL — `nssm stop LAMS-Web` first. |
| Background Services page: "Queue name cannot contain :" | Fixed in code (branch is a BullMQ `prefix`, not part of the name). Redeploy if you see it. |
| Background Services: "Could not reach Redis" | Memurai not running (`Get-Service Memurai`), OR `REDIS_URL`/`REDIS_HOST` wrong. |
| Worker connects to `localhost`/`::1` despite `REDIS_URL` pointing elsewhere | `REDIS_URL` is malformed — `redis` isn't a URL "special scheme", so `new URL()` silently accepts `redis:host...` (missing `//`) as valid with an **empty hostname**, and BullMQ falls back to its own default. Use `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` instead (§2) — no URL parsing, no encoding needed except `\$`. |
| Emails never arrive | Worker + Memurai down *and* SMTP blocked — check `worker.err.log`; confirm outbound to `mail.xcelisolutions.com:8889`. |
| 502 from IIS | Web service not running or wrong port — `curl http://127.0.0.1:3000/login`. |
| Login redirects loop | `AUTH_URL` ≠ public URL, or host header not forwarded. |
