import "server-only";

import { prisma } from "@/db/prisma";
import { searchActiveWorkers, type WorkerHit } from "@/features/daily-req/queries";

/** Loan list (vwLoans), newest first, search on LoanNo / WorkerId / WorkerName. */
export async function listLoans(search = ""): Promise<Record<string, unknown>[]> {
  const term = search.trim();
  return prisma.vwLoan.findMany({
    where: term
      ? {
          OR: [
            { loanNo: { contains: term } },
            { workerId: { contains: term } },
            { workerName: { contains: term } },
          ],
        }
      : undefined,
    orderBy: { autoId: "desc" },
    take: 200,
  });
}

/** Active loans (outstanding balance > 0) for the Last Repayment list. */
export async function listActiveLoans(search = ""): Promise<Record<string, unknown>[]> {
  const term = search.trim();
  return prisma.vwLoan.findMany({
    where: {
      loanBalance: { gt: 0 },
      ...(term
        ? {
            OR: [
              { loanNo: { contains: term } },
              { workerId: { contains: term } },
              { workerName: { contains: term } },
            ],
          }
        : {}),
    },
    orderBy: { autoId: "desc" },
    take: 200,
  });
}

/** A single loan header (tblLoans) for the edit form, or null. */
export async function getLoan(loanNo: string) {
  return prisma.tblLoan.findUnique({ where: { loanNo } });
}

/** A single loan from the view (joined worker/scheme) for the repayment panel. */
export async function getLoanView(loanNo: string) {
  return prisma.vwLoan.findUnique({ where: { loanNo } });
}

/** All loan schemes. */
export async function listSchemes(): Promise<Record<string, unknown>[]> {
  return prisma.tblLoanScheme.findMany({ orderBy: { loanScheme: "asc" } });
}

/** Repayments for a loan, newest first. */
export async function listRepayments(loanNo: string): Promise<Record<string, unknown>[]> {
  return prisma.tblLoanRepayment.findMany({
    where: { loanNo },
    orderBy: { autoId: "desc" },
  });
}

/** Count of a worker's loans with an outstanding balance (> 0). */
export async function getOutstandingLoans(workerId: string): Promise<number> {
  return prisma.tblLoan.count({ where: { workerId, loanBalance: { gt: 0 } } });
}

/** Search active workers for the loan "Find Worker" dialog (reuses daily-req search). */
export async function searchLoanWorkers(term: string): Promise<WorkerHit[]> {
  return searchActiveWorkers(term);
}
