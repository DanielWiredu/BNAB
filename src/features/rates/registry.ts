import "server-only";

import { prisma } from "@/db/prisma";
import { Permissions as P } from "@/server/auth/permissions";
import type { CrudModel } from "@/features/setups/registry";
import type { RateKey } from "./schema";

/**
 * Server-only registry for effective-dated rate resources. Maps a rate key to
 * its Prisma model (for list + in-place edit), permission, audit label, and the
 * revalidation path. Adding a new effective row goes through a stored procedure
 * (see actions.ts) — the model here is only used for reads and edits.
 */

export interface RateResourceDef {
  model: CrudModel;
  permission: string;
  label: string;
  groupScoped: boolean;
  /** Revalidation path; for group-scoped resources, `${base}/${groupId}/rates`. */
  basePath: string;
}

const m = (delegate: unknown) => delegate as unknown as CrudModel;

export const RATE_RESOURCES: Record<RateKey, RateResourceDef> = {
  "trade-group-rate": {
    model: m(prisma.tblTradeGroupRates),
    permission: P.Setups.TradePayroll,
    label: "Trade Group Rate",
    groupScoped: true,
    basePath: "/tools/trade-group",
  },
  "payroll-setup": {
    model: m(prisma.tblPayrollSetup),
    permission: P.Setups.TradePayroll,
    label: "Payroll Setup",
    groupScoped: false,
    basePath: "/tools/payroll-setup",
  },
};

export function getRateResource(key: string): RateResourceDef | undefined {
  return RATE_RESOURCES[key as RateKey];
}
