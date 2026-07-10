import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { logger } from "@/lib/logger";
import type { CreateCostSheetInput, CreateLabourRequestInput } from "./schemas";

/**
 * Inbound CLMS write handlers — the byte-compatible replacement for the two
 * GHPACLMSController POST actions.
 *
 * ADR-004: every inbound payload is logged (structured, via pino) as the
 * integration log. We deliberately do NOT add a new DB table here — the shared
 * schema is authoritative and additive tables require coordinated DDL; the log
 * stream is the drop-detection mechanism until/unless that table is provisioned.
 */

/**
 * CreateLabourRequest — idempotent on Id. Inserting into GPHALabourRequests
 * fires trg_Insert_GPHALabourRequests, which copies the row into
 * tblGPHA_LabourRequests (what the pending/all/approved UIs read). Faithful to
 * the legacy controller, which only inserted the raw landing row.
 */
export async function createLabourRequest(
  input: CreateLabourRequestInput,
): Promise<{ created: boolean; labourRequestId: string | null }> {
  logger.info(
    {
      event: "clms.inbound.labour_request",
      id: input.id,
      labourRequestId: input.labourRequestId,
    },
    "CLMS labour request received",
  );

  const existing = await prisma.gPHALabourRequests.findUnique({ where: { id: input.id } });
  if (existing) {
    return { created: false, labourRequestId: input.labourRequestId };
  }

  try {
    await prisma.gPHALabourRequests.create({
      data: {
        id: input.id,
        requestDate: input.requestDate,
        labourRequestId: input.labourRequestId,
        unitDescription: input.unitDescription,
        jobDescription: input.jobDescription,
        numberRequested: input.numberRequested,
        neededOn: input.neededOn,
        requestId: input.requestId,
        companySecret: input.companySecret,
        companyKey: input.companyKey,
        geoLocation: input.geoLocation,
        weekType: input.weekType,
        shift: input.shift,
      },
    });
  } catch (err) {
    // Concurrent insert of the same Id — treat as idempotent success.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { created: false, labourRequestId: input.labourRequestId };
    }
    throw err;
  }

  return { created: true, labourRequestId: input.labourRequestId };
}

/**
 * CreateCostSheet — transactional insert of job assignment + cost sheet +
 * details, linked by a server-generated CostSheetId (mirrors the legacy
 * controller exactly: JobAssignment first, then CostSheet, then bulk details).
 */
export async function createCostSheet(
  input: CreateCostSheetInput,
): Promise<{ costSheetId: string }> {
  const costSheetId = randomUUID();
  const ja = input.JobAssignment;
  const cs = input.CostSheet;
  const details = input.CostSheetDetails;

  logger.info(
    {
      event: "clms.inbound.cost_sheet",
      jobAssignmentId: ja.id,
      requestNumber: ja.requestNumber,
      costSheetId,
      details: details.length,
    },
    "CLMS cost sheet received",
  );

  await prisma.$transaction(async (tx) => {
    await tx.gPHAJobAssignments.create({
      data: {
        id: ja.id,
        numberToSupply: ja.numberToSupply,
        job: ja.job,
        costSheetId, // link job assignment to the cost sheet
        neededOn: ja.neededOn,
        shift: ja.shift,
        dayType: ja.dayType,
        geoLocation: ja.geoLocation,
        unit: ja.unit,
        requestNumber: ja.requestNumber,
        dateAdded: ja.dateAdded,
        numberToSupplied: ja.numberToSupplied,
      },
    });

    await tx.gPHACostSheets.create({
      data: {
        id: costSheetId,
        jobAssignmentId: ja.id,
        labourCompany: cs.labourCompany,
        companyId: cs.companyId,
        totalAmount: cs.totalAmount,
        generatedDate: cs.generatedDate,
        status: cs.status,
        shift: cs.shift,
        costSheetNumber: cs.costSheetNumber,
        dateAdded: cs.dateAdded,
        paymentReference: cs.paymentReference,
        paymentStatus: cs.paymentStatus,
      },
    });

    if (details.length > 0) {
      await tx.gPHACostSheetDetails.createMany({
        data: details.map((d) => ({
          id: d.id,
          costSheetId,
          dateAdded: d.dateAdded,
          audited: d.audited,
          auditedDate: d.auditedDate,
          rateType: d.rateType,
          hoursWorked: d.hoursWorked,
          baseRate: d.baseRate,
          premiumTotal: d.premiumTotal,
          nhilGflTotal: d.nhilGflTotal,
          vatTotal: d.vatTotal,
          transportationTotal: d.transportationTotal,
          incentiveTotal: d.incentiveTotal,
          level: d.level,
          jobDescription: d.jobDescription,
          worker: d.worker,
          workerId: d.workerId,
          company: d.company,
          shiftAllowance: d.shiftAllowance,
          nightAllowance: d.nightAllowance,
          total: d.total,
          unit: d.unit,
          auditedBy: d.auditedBy,
          overTimeHours: d.overTimeHours,
          overTimeRate: d.overTimeRate,
          groupIncentive: d.groupIncentive,
        })),
      });
    }
  });

  return { costSheetId };
}
