import { prisma } from "@/db/prisma";
import { logger } from "@/lib/logger";
import { getShiftType } from "./shift-type";
import { resolveTradeGroupId } from "./trade-groups";

/**
 * CLMS reconciliation — port of UtilitiesController.ProcessGPHAPendingApprovedRequests
 * (the legacy Hangfire every-10-minutes job). Folds approved GPHA cost-sheet hours
 * back into the matching GDLC daily requisition:
 *
 *   pending job assignments (Processed=0)
 *     → match GDLC labour request (hasCostSheet, not GPHA-approved)
 *     → its cost sheet (tblStaffReq, not yet approved)
 *     → each cost-sheet detail worker (hours > 0):
 *         · set header hours/shift once (UpdateDailyReqGPHAHours)
 *         · add the worker to the requisition (AddGPHASubStaff, insert-if-absent)
 *     → mark the request processed (GPHA_Approved + JobAssignments.Processed)
 *
 * Behaviour is kept byte-faithful for DB-state parity with the Hangfire run.
 * Errors propagate so BullMQ retries the whole batch; the run is idempotent per
 * request number (the Processed flag is the guard).
 */

export interface ReconcileResult {
  processed: string[];
}

const TRANSPORT = "*";

export async function reconcileClms(): Promise<ReconcileResult> {
  const processed: string[] = [];

  // Pending approved requests = job assignments not yet processed.
  const assignments = await prisma.gPHAJobAssignments.findMany({
    where: { processed: false },
    orderBy: { dateAdded: "desc" },
    take: 1000,
  });

  if (assignments.length === 0) {
    logger.info({ event: "clms.reconcile", processed: 0 }, "CLMS reconcile: nothing pending");
    return { processed };
  }

  for (const assignment of assignments) {
    const requestNumber = assignment.requestNumber;

    // Matching GDLC labour request: has a cost sheet, not yet GPHA-approved.
    const gdlcRequest = await prisma.tblGphaLabourRequest.findFirst({
      where: {
        hasCostSheet: true,
        gphaApproved: false,
        labourRequestId: requestNumber,
      },
    });
    if (!gdlcRequest) continue;

    const reqno = gdlcRequest.costSheetNo;
    if (!reqno) continue;

    // The GDLC cost sheet (tblStaffReq). Skip if missing or already approved.
    const staffReq = await prisma.tblStaffReq.findFirst({
      where: { OR: [{ reqNo: reqno }, { gphaRequestId: reqno }] },
    });
    if (!staffReq || staffReq.approved === true) continue;

    // Cost-sheet detail lines for this request (via its job assignments).
    const reqAssignments = await prisma.gPHAJobAssignments.findMany({
      where: { requestNumber },
      select: { costSheetId: true },
    });
    const costSheetIds = reqAssignments
      .map((a) => a.costSheetId)
      .filter((id): id is string => !!id);
    const workers =
      costSheetIds.length > 0
        ? await prisma.gPHACostSheetDetails.findMany({
            where: { costSheetId: { in: costSheetIds } },
          })
        : [];

    // NOTE: `staffReq` is a pre-loop snapshot and is intentionally NOT re-read
    // inside the loop — exactly like the legacy code — so the "set header hours"
    // branch fires for every worker and the last worker's hours win. Preserved
    // for DB-state parity.
    const headerNeedsHours =
      staffReq.normal === 0 || !staffReq.gphaRequestId;

    for (const worker of workers) {
      const hoursWorked = Number(worker.hoursWorked);
      if (hoursWorked === 0) continue;

      const overtime = Number(worker.overTimeHours);
      const shiftType = getShiftType(worker.rateType);

      if (headerNeedsHours) {
        await prisma.tblStaffReq.update({
          where: { reqNo: reqno },
          data: {
            normal: hoursWorked,
            overtime,
            gphaRequestId: gdlcRequest.labourRequestId,
            shiftType,
          },
        });
      }

      const workerId = worker.workerId.split("/")[0];
      const gdlcWorker = await prisma.vwTblWorker.findUnique({ where: { workerId } });
      if (!gdlcWorker) continue;

      // Legacy uses gdlcWorker.TradegroupId.Value; guard against a null trade
      // group so one unmapped worker can't crash the batch.
      let tradeGroupId = gdlcWorker.tradegroupId ?? 0;
      const mapped = resolveTradeGroupId(worker.level);
      if (mapped !== undefined) tradeGroupId = mapped;

      // AddGPHASubStaff — insert only if the worker isn't already allocated.
      const exists = await prisma.tblSubStaffReq.findFirst({
        where: { reqNo: reqno, workerId },
        select: { autoId: true },
      });
      if (!exists) {
        await prisma.tblSubStaffReq.create({
          data: {
            reqNo: reqno,
            workerId,
            tradegroupId: tradeGroupId,
            transport: TRANSPORT,
            normal: hoursWorked,
            overtime,
          },
        });
      }
    }

    processed.push(requestNumber);
  }

  // Mark processed requests: GPHA-approve them and flag their job assignments.
  if (processed.length > 0) {
    const now = new Date();
    await prisma.$transaction([
      prisma.tblGphaLabourRequest.updateMany({
        where: { labourRequestId: { in: processed } },
        data: { gphaApproved: true, gphaApprovedDate: now },
      }),
      prisma.gPHAJobAssignments.updateMany({
        where: { requestNumber: { in: processed } },
        data: { processed: true },
      }),
    ]);
  }

  logger.info(
    { event: "clms.reconcile", processed: processed.length, requests: processed },
    "CLMS reconcile complete",
  );
  return { processed };
}
