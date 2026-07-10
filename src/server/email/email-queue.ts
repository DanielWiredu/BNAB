import "server-only";

import { getEmailQueue, type EmailJobData } from "@/jobs/queues";
import { sendMail } from "@/server/email/mailer";
import { logger } from "@/lib/logger";

/**
 * Enqueue an email for asynchronous delivery by the worker (mirrors the legacy
 * "send enqueued through Hangfire" pattern), with an **inline fallback**.
 *
 * Transactional mail (account activation, password reset) is time-sensitive and
 * low-volume, and many deployments run without the BullMQ worker / Redis. So:
 *   1. Try to enqueue (worker owns retries + backoff when Redis is up).
 *   2. If enqueue fails (Redis unreachable), send inline right here so the email
 *      still goes out — never silently drop a user-facing email.
 *
 * Only if BOTH paths fail is the error logged and swallowed, so a mail hiccup
 * never breaks the primary user action.
 */

/**
 * Bound a promise with a timeout. BullMQ/ioredis keeps `.add()` pending while
 * Redis is unreachable (offline queue + `maxRetriesPerRequest: null`), so
 * without this the enqueue would hang instead of letting us fall back inline.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  try {
    await withTimeout(getEmailQueue().add("send-email", data), 3000);
    return;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), to: data.to },
      "email enqueue failed — falling back to inline send",
    );
  }

  try {
    await sendMail(data);
  } catch (err) {
    logger.error({ err, to: data.to }, "inline email send failed");
  }
}
