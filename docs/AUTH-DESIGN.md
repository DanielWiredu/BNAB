# Authentication & Authorization Design

How the Next.js app reproduces LAMS.Server's ASP.NET Identity + custom
permission system **against the same database, with no data migration**.

## Identity table mapping

The existing ASP.NET Identity tables are reused as-is:

| Table | Used for | Notes |
|---|---|---|
| `AspNetUsers` | User store / login | `NormalizedEmail` is the login key. `Name`, `UserKey` are custom columns; `UserKey` is carried into the session (needed for requisition-number generation in later phases). `EmailConfirmed`, `LockoutEnd`, `LockoutEnabled` honoured. |
| `AspNetRoles` / `AspNetUserRoles` | Role assignment | Loaded at sign-in. |
| `AspNetUserClaims` | Permission overrides | `ClaimType = 'Permission'`, `ClaimValue = '<key>::grant' | '<key>::revoke'`. Identical format to the legacy app → both apps compute the same effective permissions during coexistence. |
| `AspNetUsers.SecurityStamp` | Session invalidation | Embedded in the JWT; re-checked on a throttled interval. |

Access is via `src/server/repositories/user-repository.ts` (node-mssql, not
Prisma) so login works regardless of introspection state.

## Password hashes

`src/server/auth/identity-hash.ts` verifies both ASP.NET Identity formats using
only Node's `crypto` (no native deps):

- **V2** (`0x00`): PBKDF2-HMAC-SHA1, 16-byte salt, 32-byte subkey, 1000 iters.
- **V3** (`0x01`): PBKDF2 with embedded PRF / iteration count / salt length.

New/reset passwords are written back in **V3 format** (`hashIdentityPassword`),
which the legacy Blazor app can also validate — so credentials stay
interoperable while both apps run. Legacy V2 hashes are transparently upgraded to
V3 on next successful login (`needsRehash`). Comparison is constant-time.

Round-trip and known-vector tests: `identity-hash.test.ts`.

## Session

- Auth.js v5 (`next-auth@5`), **JWT strategy**, `maxAge` = `AUTH_SESSION_MAX_AGE`
  (default 3600s) — matches the legacy 1-hour sliding cookie.
- The JWT carries `userId`, `userKey`, `name`, `roles`, `securityStamp`,
  `stampCheckedAt`.
- **Security-stamp revalidation** (`auth.ts` `jwt` callback): at most once per
  `AUTH_STAMP_REVALIDATE_SECONDS` (default 600s), re-reads the DB stamp; a
  mismatch invalidates the session. Mirrors `SecurityStampValidatorOptions`.
  This runs only in Node contexts (route handlers / server components), never in
  edge middleware — see the config split below.

## Permissions (two-layer model)

Ported verbatim from `AppModels/Auth/AppPermissions.cs` into
`src/server/auth/permissions.ts` (keys, role defaults, display names, groups):

```
effective = (union of role defaults) − revokes ∪ grants
```

- `computeEffectivePermissions(roles, claims)` — the effective set.
- `computePermissionStatus(roles, claims)` — per-permission provenance
  (role / grant / revoke / none) for the admin panel.
- `permission-service.ts` loads roles+claims from the DB, computes, and caches
  per user for **15 minutes** (matches legacy `MemoryCache`), with
  `invalidatePermissionCache(userId)` on grant/revoke.
- **Permissions are NOT baked into the JWT** — they're computed per request, so
  changes take effect within the cache window without a re-login (same as the
  Blazor app). ⚠ The cache is in-process; move to Redis for multi-instance.

Parity guard: `permissions.test.ts` (46 permissions, 7 roles, Admin = all, every
default references a known key). Keep it in lockstep with the C# source.

## Enforcement points

| Layer | Mechanism | File |
|---|---|---|
| Edge (redirect) | `authorized` callback → authenticated-or-redirect | `auth.config.ts`, `middleware.ts` |
| Server code | `requirePermission(key)` throws `ForbiddenError`; `requirePermissionOrRedirect` redirects to `/access-denied` | `server/auth/require-permission.ts` |
| UI visibility | `<Can permission=…>` / `usePermissions()` (server passes the effective set into `PermissionProvider`) | `features/auth/permission-context.tsx` |

UI checks are convenience only — **all real authorization is server-side.**

## Edge/Node config split

- `auth.config.ts` — edge-safe: no DB access; only `authorized`. Used by
  `middleware.ts`.
- `auth.ts` — Node: Credentials provider + DB-backed `jwt`/`session` callbacks
  (hash verify, role load, stamp revalidation). Used by route handlers and
  `auth()` in server components.

This keeps Prisma/mssql/`crypto` out of the edge runtime.

## Not yet implemented (later phases)

- Password reset email (needs the Nodemailer/jobs module — Phase 4/F12).
- 2FA / external logins — **parked** pending confirmation anyone uses them
  (open question in the migration plan).
- Admin Users page grant/revoke UI — Phase 9 (F11); the service layer is ready.
