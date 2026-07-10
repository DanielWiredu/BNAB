"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { loanSchema, loanSchemeSchema, repaymentSchema } from "./schema";
import { searchLoanWorkers, getOutstandingLoans } from "./queries";
import {
  spAddLoan,
  spUpdateLoan,
  spApproveLoan,
  spAddLoanRepayment,
  spApproveLoanRepayment,
  spDeleteLoanRepayment,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";
import type { WorkerHit } from "@/features/daily-req/queries";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionResultData<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorize(
  permission: string,
): Promise<{ ok: true; actor: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: true, actor: (user.userKey || user.name || user.email || user.id).slice(0, 50) };
}

// ── Worker lookup (for the loan form) ────────────────────────────────────────

export async function findWorkersForLoan(term: string): Promise<WorkerHit[]> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.Loans.Manage))) return [];
  return searchLoanWorkers(term);
}

export async function workerOutstandingLoans(workerId: string): Promise<number> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.Loans.Manage))) return 0;
  return getOutstandingLoans(workerId);
}

// ── Loan schemes ─────────────────────────────────────────────────────────────

export async function createScheme(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  const parsed = loanSchemeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await prisma.tblLoanScheme.create({
      data: { loanScheme: parsed.data.loanScheme, accountNo: parsed.data.accountNo, createdDate: new Date() },
    });
    await logAction("ADD Loan Scheme", parsed.data.loanScheme);
    revalidatePath("/loans/scheme");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "createScheme failed");
    return { ok: false, error: "Could not add the loan scheme." };
  }
}

export async function updateScheme(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  const parsed = loanSchemeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (!parsed.data.id) return { ok: false, error: "Missing scheme id." };
  try {
    await prisma.tblLoanScheme.update({
      where: { id: parsed.data.id },
      data: { loanScheme: parsed.data.loanScheme, accountNo: parsed.data.accountNo },
    });
    await logAction("EDIT Loan Scheme", parsed.data.loanScheme);
    revalidatePath("/loans/scheme");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateScheme failed");
    return { ok: false, error: "Could not update the loan scheme." };
  }
}

export async function deleteScheme(id: number): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  try {
    await prisma.tblLoanScheme.delete({ where: { id } });
    await logAction("DELETE Loan Scheme", String(id));
    revalidatePath("/loans/scheme");
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { ok: false, error: "This scheme is in use by one or more loans and cannot be deleted." };
    }
    logger.error({ err, id }, "deleteScheme failed");
    return { ok: false, error: "Could not delete the loan scheme." };
  }
}

// ── Loans ────────────────────────────────────────────────────────────────────

export async function createLoan(values: unknown): Promise<ActionResultData<{ loanNo: string }>> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  const parsed = loanSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  try {
    const result = await spAddLoan({
      workerId: v.workerId,
      loanSchemeId: v.loanSchemeId,
      loanDate: v.loanDate,
      loanAmount: v.loanAmount,
      repayAmount: v.repayAmount,
      monthlyLimit: v.monthlyLimit,
      autoDeduct: v.autoDeduct,
      createdBy: auth.actor,
    });
    if (!result.ok) {
      const msg =
        result.reason === "pending-scheme"
          ? "Worker has a pending loan on the same scheme. Cannot save."
          : result.reason === "pending-any"
            ? "Worker has a pending loan and cannot take any more loans."
            : "Could not create the loan.";
      return { ok: false, error: msg };
    }
    await logAction("ADD Loan", result.loanNo);
    revalidatePath("/loans/manage");
    return { ok: true, data: { loanNo: result.loanNo } };
  } catch (err) {
    logger.error({ err }, "createLoan failed");
    return { ok: false, error: "Could not create the loan. Please try again." };
  }
}

export async function updateLoan(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  const parsed = loanSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  if (!v.loanNo) return { ok: false, error: "Missing loan number." };
  try {
    const result = await spUpdateLoan({
      loanNo: v.loanNo,
      workerId: v.workerId,
      loanSchemeId: v.loanSchemeId,
      loanDate: v.loanDate,
      loanAmount: v.loanAmount,
      repayAmount: v.repayAmount,
      monthlyLimit: v.monthlyLimit,
      repaidAmount: v.repaidAmount,
      autoDeduct: v.autoDeduct,
      updatedBy: auth.actor,
    });
    if (!result.ok) return { ok: false, error: "Could not update the loan." };
    await logAction("EDIT Loan", v.loanNo);
    revalidatePath("/loans/manage");
    revalidatePath(`/loans/manage/${v.loanNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateLoan failed");
    return { ok: false, error: "Could not update the loan. Please try again." };
  }
}

export async function approveLoan(loanNo: string): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  try {
    const result = await spApproveLoan({ loanNo, approvedDate: new Date(), approvedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not approve the loan." };
    await logAction("APPROVE Loan", loanNo);
    revalidatePath("/loans/manage");
    revalidatePath(`/loans/manage/${loanNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, loanNo }, "approveLoan failed");
    return { ok: false, error: "Could not approve the loan. Please try again." };
  }
}

export async function deleteLoan(loanNo: string): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Manage);
  if (!auth.ok) return auth;
  try {
    const loan = await prisma.tblLoan.findUnique({ where: { loanNo }, select: { approved: true } });
    if (!loan) return { ok: false, error: "That loan no longer exists." };
    if (loan.approved === true) return { ok: false, error: "Approved loans cannot be deleted." };
    await prisma.tblLoan.delete({ where: { loanNo } });
    await logAction("DELETE Loan", loanNo);
    revalidatePath("/loans/manage");
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { ok: false, error: "This loan has repayments and cannot be deleted." };
    }
    logger.error({ err, loanNo }, "deleteLoan failed");
    return { ok: false, error: "Could not delete the loan. Please try again." };
  }
}

// ── Repayments ───────────────────────────────────────────────────────────────

export async function addRepayment(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Repayment);
  if (!auth.ok) return auth;
  const parsed = repaymentSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  try {
    const result = await spAddLoanRepayment({
      loanNo: v.loanNo,
      workerId: v.workerId,
      repayDate: v.repayDate,
      repayAmount: v.repayAmount,
      manualReceiptNo: v.manualReceiptNo,
      createdBy: auth.actor,
    });
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.reason === "duplicate-receipt"
            ? "That receipt number has already been used for another payment."
            : "Could not save the repayment.",
      };
    }
    await logAction("ADD Loan Repayment", v.loanNo);
    revalidatePath(`/loans/repayment/${v.loanNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "addRepayment failed");
    return { ok: false, error: "Could not save the repayment. Please try again." };
  }
}

export async function approveRepayment(
  autoId: number,
  loanNo: string,
): Promise<ActionResultData<{ repaidAmount: number; loanBalance: number }>> {
  const auth = await authorize(P.Loans.Repayment);
  if (!auth.ok) return auth;
  try {
    const result = await spApproveLoanRepayment({ autoId, loanNo, approvedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not approve the repayment." };
    await logAction("APPROVE Loan Repayment", loanNo);
    revalidatePath(`/loans/repayment/${loanNo}`);
    return { ok: true, data: { repaidAmount: result.repaidAmount, loanBalance: result.loanBalance } };
  } catch (err) {
    logger.error({ err, autoId }, "approveRepayment failed");
    return { ok: false, error: "Could not approve the repayment. Please try again." };
  }
}

export async function deleteRepayment(autoId: number, loanNo: string): Promise<ActionResult> {
  const auth = await authorize(P.Loans.Repayment);
  if (!auth.ok) return auth;
  try {
    const result = await spDeleteLoanRepayment(autoId);
    if (!result.ok) return { ok: false, error: "Could not delete the repayment." };
    await logAction("DELETE Loan Repayment", loanNo);
    revalidatePath(`/loans/repayment/${loanNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, autoId }, "deleteRepayment failed");
    return { ok: false, error: "Could not delete the repayment. Please try again." };
  }
}
