import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { reconcileClms } from "@/server/integrations/clms/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron entrypoint for CLMS reconciliation — the JOB_MODE=inline
 * counterpart to the BullMQ repeatable job registered in jobs/worker.ts.
 *
 * Only acts when JOB_MODE=inline, so leaving this cron configured in
 * vercel.json is harmless if you switch back to JOB_MODE=queue with the
 * worker running elsewhere — it becomes a no-op instead of double-processing
 * alongside the worker.
 *
 * Protected by CRON_SECRET: Vercel Cron automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when that env var is set, so this
 * rejects any other caller.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.JOB_MODE !== "inline") {
    return NextResponse.json({ skipped: true, reason: "JOB_MODE is not 'inline'" });
  }

  try {
    const result = await reconcileClms();
    logger.info({ processed: result.processed.length }, "cron: CLMS reconcile ran");
    return NextResponse.json({ ok: true, processed: result.processed.length });
  } catch (err) {
    logger.error({ err }, "cron: CLMS reconcile failed");
    return NextResponse.json({ ok: false, error: "reconcile failed" }, { status: 500 });
  }
}
