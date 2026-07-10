import { z } from "zod";

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
 * Client-safe UI descriptors for each setup resource: table columns and form
 * fields. No Prisma / server-only imports here — imported by the pages and the
 * ResourceManager client component. (Permission enforcement is server-side in
 * registry.ts; the permission here only drives button visibility.)
 */

export type FieldType = "text" | "number" | "textarea" | "select" | "email";

export interface Option {
  label: string;
  value: string | number;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: Option[];
  /** Pull options at runtime from ResourceManager's `fieldOptions` by this key. */
  optionsKey?: string;
  colSpan?: 1 | 2;
}

export interface SetupColumn {
  key: string;
  header: string;
  className?: string;
}

/**
 * Optional per-row navigation link (e.g. Trade Group → its Rates page).
 * Declarative (not a function) so a ResourceUi can be passed from a server
 * component to the client ResourceManager as a serializable prop.
 */
export interface RowLink {
  label: string;
  /** Href is built as `${basePath}/${row[idField]}${suffix ?? ""}`. */
  basePath: string;
  idField: string;
  suffix?: string;
}

export interface ResourceUi {
  key: ResourceKey;
  title: string;
  singular: string;
  permission: string;
  idField: string;
  columns: SetupColumn[];
  fields: FieldDef[];
  /** Whether rows can be deleted (default true). */
  canDelete?: boolean;
  /** Extra per-row link rendered before the edit action. */
  rowLink?: RowLink;
}

export const SETUP_SCHEMAS: Record<ResourceKey, z.ZodTypeAny> = {
  gang: gangSchema,
  vessel: vesselSchema,
  cargo: cargoSchema,
  nationality: nationalitySchema,
  location: locationSchema,
  "reporting-point": reportingPointSchema,
  bank: bankSchema,
  "bank-branch": bankBranchSchema,
  "dle-company": dleCompanySchema,
  "trade-group": tradeGroupSchema,
  "trade-type": tradeTypeSchema,
};

export const SETUP_UI: Record<ResourceKey, ResourceUi> = {
  gang: {
    key: "gang",
    title: "Gangs",
    singular: "Gang",
    permission: P.Setups.Manage,
    idField: "gangId",
    columns: [
      { key: "gangName", header: "Gang Name" },
      { key: "notes", header: "Notes" },
    ],
    fields: [
      { name: "gangName", label: "Gang Name" },
      { name: "notes", label: "Notes", type: "textarea", colSpan: 2 },
    ],
  },
  vessel: {
    key: "vessel",
    title: "Vessels",
    singular: "Vessel",
    permission: P.Setups.Manage,
    idField: "vesselId",
    columns: [{ key: "vesselName", header: "Vessel Name" }],
    fields: [{ name: "vesselName", label: "Vessel Name" }],
  },
  cargo: {
    key: "cargo",
    title: "Cargo",
    singular: "Cargo",
    permission: P.Setups.Manage,
    idField: "cargoId",
    columns: [{ key: "cargoName", header: "Cargo Name" }],
    fields: [{ name: "cargoName", label: "Cargo Name" }],
  },
  nationality: {
    key: "nationality",
    title: "Nationalities",
    singular: "Nationality",
    permission: P.Setups.Manage,
    idField: "id",
    columns: [{ key: "nationality", header: "Nationality" }],
    fields: [{ name: "nationality", label: "Nationality" }],
  },
  location: {
    key: "location",
    title: "Locations",
    singular: "Location",
    permission: P.Setups.Manage,
    idField: "locationId",
    columns: [{ key: "location", header: "Location" }],
    fields: [{ name: "location", label: "Location" }],
  },
  "reporting-point": {
    key: "reporting-point",
    title: "Reporting Points",
    singular: "Reporting Point",
    permission: P.Setups.Manage,
    idField: "reportingPointId",
    columns: [{ key: "reportingPoint", header: "Reporting Point" }],
    fields: [{ name: "reportingPoint", label: "Reporting Point" }],
  },
  bank: {
    key: "bank",
    title: "Banks",
    singular: "Bank",
    permission: P.Setups.Manage,
    idField: "bankId",
    columns: [{ key: "bankName", header: "Bank Name" }],
    fields: [{ name: "bankName", label: "Bank Name" }],
  },
  "bank-branch": {
    key: "bank-branch",
    title: "Bank Branches",
    singular: "Bank Branch",
    permission: P.Setups.Manage,
    idField: "branchId",
    columns: [
      { key: "branchName", header: "Branch Name" },
      { key: "bankName", header: "Bank" },
      { key: "sortCode", header: "Sort Code" },
    ],
    fields: [
      { name: "branchName", label: "Branch Name" },
      { name: "bankId", label: "Bank", type: "select", optionsKey: "banks" },
      { name: "sortCode", label: "Sort Code" },
    ],
  },
  "dle-company": {
    key: "dle-company",
    title: "DLE Companies",
    singular: "DLE Company",
    permission: P.Setups.DleCompany,
    idField: "dlecodeCompanyId",
    columns: [
      { key: "dlecodeCompanyName", header: "Company Name" },
      { key: "dletel", header: "Tel" },
      { key: "email", header: "Email" },
      { key: "sharePerc", header: "Share %" },
    ],
    fields: [
      { name: "dlecodeCompanyName", label: "Company Name", colSpan: 2 },
      { name: "dleaddr", label: "Address", type: "textarea", colSpan: 2 },
      { name: "dletel", label: "Telephone" },
      { name: "email", label: "Email", type: "email" },
      { name: "pattern", label: "Pattern" },
      { name: "sharePerc", label: "Share %", type: "number" },
      { name: "fcontp", label: "Finance Contact" },
      { name: "ftel", label: "Finance Tel" },
      { name: "femail", label: "Finance Email", type: "email" },
      { name: "ocontp", label: "Operations Contact" },
      { name: "otel", label: "Operations Tel" },
      { name: "oemail", label: "Operations Email", type: "email" },
      { name: "acontp", label: "Admin Contact" },
      { name: "atel", label: "Admin Tel" },
      { name: "aemail", label: "Admin Email", type: "email" },
    ],
  },
  "trade-group": {
    key: "trade-group",
    title: "Trade Groups",
    singular: "Trade Group",
    permission: P.Setups.TradePayroll,
    idField: "tradegroupId",
    // Legacy Trade Group has edit + a Rates link, but no delete.
    canDelete: false,
    rowLink: {
      label: "Rates",
      basePath: "/tools/trade-group",
      idField: "tradegroupId",
      suffix: "/rates",
    },
    columns: [
      { key: "tradegroupName", header: "Trade Group" },
      { key: "gphaGroupId", header: "GPHA Group ID" },
    ],
    fields: [
      { name: "tradegroupName", label: "Trade Group Name", colSpan: 2 },
      { name: "gphaGroupId", label: "GPHA Group ID" },
      { name: "dnotes", label: "Notes", type: "textarea", colSpan: 2 },
    ],
  },
  "trade-type": {
    key: "trade-type",
    title: "Trade Types",
    singular: "Trade Type",
    permission: P.Setups.TradePayroll,
    idField: "tradetypeId",
    columns: [
      { key: "tradegroupName", header: "Group" },
      { key: "tradetypeName", header: "Trade Type" },
      { key: "prefixname", header: "Prefix" },
    ],
    fields: [
      { name: "tradegroupId", label: "Trade Group", type: "select", optionsKey: "tradeGroups", colSpan: 2 },
      { name: "tradetypeName", label: "Trade Type Name" },
      { name: "prefixname", label: "Prefix" },
      { name: "gphaJobId", label: "GPHA Job ID" },
      { name: "trnote", label: "Notes", type: "textarea", colSpan: 2 },
    ],
  },
};
