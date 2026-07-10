import { z } from "zod";

/**
 * Zod validators for the inbound GPHA CLMS payloads. Field names mirror the
 * legacy C# DTOs (AppModels/GPHAdtos.cs) PascalCase-for-PascalCase so the wire
 * contract stays byte-compatible — the external caller can POST the exact same
 * JSON to the new endpoint. Each schema transforms to a clean camelCase shape
 * consumed by the inbound handlers.
 */

const guid = z.string().uuid();
const dt = z.coerce.date();
// Optional strings arrive as string | null | undefined; normalise absent → null.
const nstr = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

// ── POST /CreateLabourRequest ────────────────────────────────────────────────

export const createLabourRequestSchema = z
  .object({
    Id: guid,
    RequestDate: dt,
    LabourRequestId: nstr,
    UnitDescription: nstr,
    JobDescription: nstr,
    NumberRequested: z.number().int(),
    NeededOn: dt,
    RequestId: nstr,
    CompanySecret: nstr,
    CompanyKey: nstr,
    GeoLocation: nstr,
    Shift: nstr,
    WeekType: nstr,
  })
  .transform((v) => ({
    id: v.Id,
    requestDate: v.RequestDate,
    labourRequestId: v.LabourRequestId,
    unitDescription: v.UnitDescription,
    jobDescription: v.JobDescription,
    numberRequested: v.NumberRequested,
    neededOn: v.NeededOn,
    requestId: v.RequestId,
    companySecret: v.CompanySecret,
    companyKey: v.CompanyKey,
    geoLocation: v.GeoLocation,
    shift: v.Shift,
    weekType: v.WeekType,
  }));

export type CreateLabourRequestInput = z.infer<typeof createLabourRequestSchema>;

// ── POST /CreateCostSheet ────────────────────────────────────────────────────

const jobAssignmentSchema = z
  .object({
    Id: guid,
    NumberToSupply: z.number().int(),
    Job: z.string(),
    CostSheetId: guid.optional(), // overwritten server-side
    NeededOn: dt,
    Shift: z.boolean(),
    DayType: z.string(),
    GeoLocation: z.string(),
    Unit: z.string(),
    RequestNumber: z.string(),
    DateAdded: dt,
    NumberToSupplied: z.number().int(),
  })
  .transform((v) => ({
    id: v.Id,
    numberToSupply: v.NumberToSupply,
    job: v.Job,
    neededOn: v.NeededOn,
    shift: v.Shift,
    dayType: v.DayType,
    geoLocation: v.GeoLocation,
    unit: v.Unit,
    requestNumber: v.RequestNumber,
    dateAdded: v.DateAdded,
    numberToSupplied: v.NumberToSupplied,
  }));

const costSheetSchema = z
  .object({
    LabourCompany: z.string(),
    CompanyId: guid,
    TotalAmount: z.number(),
    GeneratedDate: dt,
    Status: z.string(),
    Shift: z.string(),
    CostSheetNumber: z.string(),
    DateAdded: dt,
    PaymentReference: z.string().nullish().transform((v) => v ?? null),
    PaymentStatus: z.boolean(),
  })
  .transform((v) => ({
    labourCompany: v.LabourCompany,
    companyId: v.CompanyId,
    totalAmount: v.TotalAmount,
    generatedDate: v.GeneratedDate,
    status: v.Status,
    shift: v.Shift,
    costSheetNumber: v.CostSheetNumber,
    dateAdded: v.DateAdded,
    paymentReference: v.PaymentReference,
    paymentStatus: v.PaymentStatus,
  }));

const costSheetDetailSchema = z
  .object({
    Id: guid,
    DateAdded: dt,
    Audited: z.boolean(),
    AuditedDate: dt.nullish().transform((v) => v ?? null),
    RateType: z.string(),
    HoursWorked: z.number(),
    BaseRate: z.number(),
    PremiumTotal: z.number(),
    NHilGflTotal: z.number(),
    VatTotal: z.number(),
    TransportationTotal: z.number(),
    IncentiveTotal: z.number(),
    Level: z.string(),
    JobDescription: z.string(),
    Worker: z.string(),
    WorkerId: z.string(),
    Company: z.string(),
    ShiftAllowance: z.number(),
    NightAllowance: z.number(),
    Total: z.number(),
    Unit: z.string(),
    AuditedBy: z.string().nullish().transform((v) => v ?? null),
    OverTimeHours: z.number(),
    OverTimeRate: z.number(),
    GroupIncentive: z.number(),
  })
  .transform((v) => ({
    id: v.Id,
    dateAdded: v.DateAdded,
    audited: v.Audited,
    auditedDate: v.AuditedDate,
    rateType: v.RateType,
    hoursWorked: v.HoursWorked,
    baseRate: v.BaseRate,
    premiumTotal: v.PremiumTotal,
    nhilGflTotal: v.NHilGflTotal,
    vatTotal: v.VatTotal,
    transportationTotal: v.TransportationTotal,
    incentiveTotal: v.IncentiveTotal,
    level: v.Level,
    jobDescription: v.JobDescription,
    worker: v.Worker,
    workerId: v.WorkerId,
    company: v.Company,
    shiftAllowance: v.ShiftAllowance,
    nightAllowance: v.NightAllowance,
    total: v.Total,
    unit: v.Unit,
    auditedBy: v.AuditedBy,
    overTimeHours: v.OverTimeHours,
    overTimeRate: v.OverTimeRate,
    groupIncentive: v.GroupIncentive,
  }));

export const createCostSheetSchema = z.object({
  JobAssignment: jobAssignmentSchema,
  CostSheet: costSheetSchema,
  CostSheetDetails: z.array(costSheetDetailSchema).default([]),
});

export type CreateCostSheetInput = z.infer<typeof createCostSheetSchema>;
export type JobAssignmentInput = z.infer<typeof jobAssignmentSchema>;
export type CostSheetDetailInput = z.infer<typeof costSheetDetailSchema>;
