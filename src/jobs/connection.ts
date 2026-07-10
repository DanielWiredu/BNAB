import type { ConnectionOptions } from "bullmq";

// NOTE: no `server-only` here — this module is imported by the standalone
// worker process (tsx/Node), where `server-only` would throw at import time.

/**
 * Redis connection options for BullMQ.
 *
 * We pass plain options (not a pre-built ioredis instance) so BullMQ manages its
 * own connections with its bundled ioredis — this avoids a type/version conflict
 * between the top-level ioredis and the copy nested under bullmq, and is the
 * pattern BullMQ recommends. `maxRetriesPerRequest: null` is required by BullMQ
 * for its blocking commands.
 *
 * Prefers discrete `REDIS_HOST`/`REDIS_PORT`/`REDIS_USERNAME`/`REDIS_PASSWORD`
 * vars (same pattern as `MSSQL_*` alongside `DATABASE_URL`) so a password
 * containing URL-reserved characters (`@ # $ ^`) never has to survive both
 * dotenv-expand AND URL percent-encoding. A managed-Redis password almost
 * always contains at least one of those.
 *
 * Falls back to parsing `REDIS_URL` for anyone who prefers a single connection
 * string — but note `redis://` (with the `//`) is required: `redis:` alone is
 * not a URL "special scheme", so `new URL()` silently parses it as an opaque
 * path with an EMPTY hostname (no throw) rather than failing loudly, and
 * BullMQ then connects to its own default (localhost) instead of erroring.
 */
export function redisConnection(): ConnectionOptions {
  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
      maxRetriesPerRequest: null,
    };
  }

  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isFinite(db) ? db : undefined,
    maxRetriesPerRequest: null,
  };
}
