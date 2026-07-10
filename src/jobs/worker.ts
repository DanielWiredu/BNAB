/**
 * Background job worker (BullMQ) — entrypoint.
 *
 * Runs beside the Next.js app (as a Windows Service in production, see
 * docs/DEPLOYMENT.md) and hosts the two jobs that replace Hangfire:
 *   1. CLMS reconciliation — repeatable `*\/10 * * * *`, replacing the legacy
 *      ProcessGPHAPendingApprovedRequests recurring job.
 *   2. Email queue — fire-and-forget sends, replacing Hangfire email dispatch.
 *
 * Run with:  npm run worker
 *
 * Requires a reachable Redis (REDIS_URL; Memurai on Windows). The Hangfire
 * recurring job in AppMain/LAMS.Server MUST be disabled at cutover or hours will
 * be double-pushed (the SP guards are a backstop, not the mechanism).
 */

import "../lib/env";

import { Worker, type Job } from "bullmq";

import { logger } from "../lib/logger";
import { redisConnection } from "./connection";
import {
  BRANCH,
  CLMS_QUEUE,
  CLMS_RECONCILE_CRON,
  CLMS_RECONCILE_JOB,
  EMAIL_QUEUE,
  getClmsQueue,
  type EmailJobData,
} from "./queues";
import { sendMail } from "../server/email/mailer";
import { reconcileClms } from "../server/integrations/clms/reconcile";

async function registerReconcileSchedule(): Promise<void> {
  // Idempotent: upserts the repeatable job so restarts don't create duplicates.
  await getClmsQueue().add(
    CLMS_RECONCILE_JOB,
    {},
    {
      repeat: { pattern: CLMS_RECONCILE_CRON },
      jobId: CLMS_RECONCILE_JOB, // stable id keeps a single schedule per branch
    },
  );
  logger.info(
    { queue: CLMS_QUEUE, cron: CLMS_RECONCILE_CRON },
    "CLMS reconcile schedule registered",
  );
}

async function main() {
  const connection = redisConnection();
  logger.info(
    { emailQueue: EMAIL_QUEUE, clmsQueue: CLMS_QUEUE },
    "worker starting",
  );

  const clmsWorker = new Worker(
    CLMS_QUEUE,
    async (job: Job) => {
      if (job.name === CLMS_RECONCILE_JOB) {
        const result = await reconcileClms();
        return { processed: result.processed.length };
      }
      logger.warn({ jobName: job.name }, "unknown CLMS job");
    },
    { connection, prefix: BRANCH, concurrency: 1 }, // one reconcile at a time per branch
  );

  const emailWorker = new Worker<EmailJobData>(
    EMAIL_QUEUE,
    async (job: Job<EmailJobData>) => {
      await sendMail(job.data);
    },
    { connection, prefix: BRANCH, concurrency: 5 },
  );

  for (const [name, w] of [
    ["clms", clmsWorker],
    ["email", emailWorker],
  ] as const) {
    w.on("failed", (job, err) =>
      logger.error({ queue: name, jobId: job?.id, err: err.message }, "job failed"),
    );
    w.on("completed", (job) =>
      logger.debug({ queue: name, jobId: job.id }, "job completed"),
    );
  }

  await registerReconcileSchedule();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutting down");
    // Worker.close() tears down the connections BullMQ created from the options.
    await Promise.allSettled([clmsWorker.close(), emailWorker.close()]);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  logger.info("worker ready");
}

main().catch((err) => {
  logger.error({ err }, "[worker] fatal");
  process.exit(1);
});
