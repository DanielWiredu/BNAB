import { Queue } from "bullmq";

import { redisConnection } from "./connection";

/**
 * BullMQ queue definitions — the Phase-4 replacement for Hangfire.
 *
 * The legacy branch queue name (HangfireSettings:QueueName, value "tema") is
 * carried over as the BullMQ **key prefix** so the multi-branch design holds:
 * each branch's Redis keys live under `<branch>:...` (e.g. `tema:email:*`).
 *
 * IMPORTANT: BullMQ v5 forbids `:` in a *queue name* (it's the reserved key
 * separator — a name like `tema:email` throws "Queue name cannot contain :").
 * The branch namespace therefore goes in `prefix`, NOT the name (see QUEUE_OPTS);
 * the Worker MUST be constructed with the same prefix (see jobs/worker.ts).
 *
 * Queues are created lazily (first use) via the shared Redis connection so that
 * importing this module during `next build` doesn't require a running Redis.
 *
 * NOTE: no `server-only` — the standalone worker (tsx/Node) imports this too.
 */

/** Branch namespace — used as the BullMQ key prefix (Queue + Worker must match). */
export const BRANCH = process.env.BRANCH_QUEUE || "default";

export const EMAIL_QUEUE = "email";
export const CLMS_QUEUE = "clms";

/** Repeatable job name + cron for the CLMS reconciliation (was every 10 min). */
export const CLMS_RECONCILE_JOB = "clms-reconcile";
export const CLMS_RECONCILE_CRON = "*/10 * * * *";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let emailQueue: Queue<EmailJobData> | undefined;
let clmsQueue: Queue | undefined;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
      connection: redisConnection(),
      prefix: BRANCH,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 15_000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }
  return emailQueue;
}

export function getClmsQueue(): Queue {
  if (!clmsQueue) {
    clmsQueue = new Queue(CLMS_QUEUE, {
      connection: redisConnection(),
      prefix: BRANCH,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }
  return clmsQueue;
}
