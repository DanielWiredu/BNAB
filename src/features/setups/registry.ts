import "server-only";

import type { ZodTypeAny } from "zod";

import { prisma } from "@/db/prisma";
import { Permissions as P } from "@/server/auth/permissions";
import {
  gangSchema,
  vesselSchema,
  cargoSchema,
  nationalitySchema,
  locationSchema,
  reportingPointSchema,
  bankSchema,
  bankBranchSchema,
  dleCompanySchema,
  tradeGroupSchema,
  tradeTypeSchema,
  type ResourceKey,
} from "./schema";

/**
 * Server-only registry of setup resources. Maps a resource key to its Prisma
 * model, validation schema, required permission, PK field, and audit metadata.
 *
 * The permission is looked up here (trusted), never taken from the client — so
 * a client can't escalate by passing a different key/permission.
 */

// Minimal structural type the Prisma model delegates satisfy.
export interface CrudModel {
  findMany(args?: unknown): Promise<Record<string, unknown>[]>;
  create(args: { data: unknown }): Promise<Record<string, unknown>>;
  update(args: { where: unknown; data: unknown }): Promise<Record<string, unknown>>;
  delete(args: { where: unknown }): Promise<Record<string, unknown>>;
}

export interface ResourceDef {
  model: CrudModel;
  schema: ZodTypeAny;
  permission: string;
  idField: string;
  /** Field used as the audit ActionID + human label of a record. */
  nameField: string;
  /** Human label for audit descriptions, e.g. "Gang". */
  label: string;
  /** Path to revalidate after a mutation. */
  path: string;
  orderBy: string;
}

const m = (delegate: unknown) => delegate as unknown as CrudModel;

export const RESOURCES: Record<ResourceKey, ResourceDef> = {
  gang: {
    model: m(prisma.tblGangs),
    schema: gangSchema,
    permission: P.Setups.Manage,
    idField: "gangId",
    nameField: "gangName",
    label: "Gang",
    path: "/setups/gang",
    orderBy: "gangName",
  },
  vessel: {
    model: m(prisma.tblVessel),
    schema: vesselSchema,
    permission: P.Setups.Manage,
    idField: "vesselId",
    nameField: "vesselName",
    label: "Vessel",
    path: "/setups/vessel",
    orderBy: "vesselName",
  },
  cargo: {
    model: m(prisma.tblCargo),
    schema: cargoSchema,
    permission: P.Setups.Manage,
    idField: "cargoId",
    nameField: "cargoName",
    label: "Cargo",
    path: "/setups/cargo",
    orderBy: "cargoName",
  },
  nationality: {
    model: m(prisma.tblNationality),
    schema: nationalitySchema,
    permission: P.Setups.Manage,
    idField: "id",
    nameField: "nationality",
    label: "Nationality",
    path: "/setups/nationality",
    orderBy: "nationality",
  },
  location: {
    model: m(prisma.tblLocation),
    schema: locationSchema,
    permission: P.Setups.Manage,
    idField: "locationId",
    nameField: "location",
    label: "Location",
    path: "/setups/location",
    orderBy: "location",
  },
  "reporting-point": {
    model: m(prisma.tblReportingPoint),
    schema: reportingPointSchema,
    permission: P.Setups.Manage,
    idField: "reportingPointId",
    nameField: "reportingPoint",
    label: "Reporting Point",
    path: "/setups/reporting-point",
    orderBy: "reportingPoint",
  },
  bank: {
    model: m(prisma.tblBanks),
    schema: bankSchema,
    permission: P.Setups.Manage,
    idField: "bankId",
    nameField: "bankName",
    label: "Bank",
    path: "/setups/bank",
    orderBy: "bankName",
  },
  "bank-branch": {
    model: m(prisma.tblBankBranches),
    schema: bankBranchSchema,
    permission: P.Setups.Manage,
    idField: "branchId",
    nameField: "branchName",
    label: "Bank Branch",
    path: "/setups/bank-branch",
    orderBy: "branchName",
  },
  "dle-company": {
    model: m(prisma.tblDLECompany),
    schema: dleCompanySchema,
    permission: P.Setups.DleCompany,
    idField: "dlecodeCompanyId",
    nameField: "dlecodeCompanyName",
    label: "DLE Company",
    path: "/tools/dle-company",
    orderBy: "dlecodeCompanyName",
  },
  "trade-group": {
    model: m(prisma.tblTradeGroup),
    schema: tradeGroupSchema,
    permission: P.Setups.TradePayroll,
    idField: "tradegroupId",
    nameField: "tradegroupName",
    label: "Trade Group",
    path: "/tools/trade-group",
    orderBy: "tradegroupName",
  },
  "trade-type": {
    model: m(prisma.tblTradeType),
    schema: tradeTypeSchema,
    permission: P.Setups.TradePayroll,
    idField: "tradetypeId",
    nameField: "tradetypeName",
    label: "Trade Type",
    path: "/tools/trade-type",
    orderBy: "tradetypeName",
  },
};

export function getResource(key: string): ResourceDef | undefined {
  return RESOURCES[key as ResourceKey];
}
