import { callProcedure, sql } from "./mssql";

/**
 * Typed wrappers around SQL Server stored procedures.
 *
 * Convention: one exported function per SP. Inputs are a typed object; the
 * wrapper maps them to SQL parameters, executes, and returns a shaped result
 * (turning magic-int RETURN values / OUTPUT params into named fields).
 *
 * As each module is migrated, add its SPs here rather than calling SQL from
 * services or route handlers. See docs/DB-MAPPING.md for the SP inventory.
 */

// ── Audit trail ─────────────────────────────────────────────────────────────

/**
 * spAddAuditTrail — appends a row to tblAuditTrail.
 * Legacy: BusinessLogic writes audit entries through this SP on every mutation.
 */
export async function spAddAuditTrail(input: {
  actionDate: Date;
  actionBy: string;
  actionDescription: string;
  actionId: string | null;
}): Promise<void> {
  await callProcedure("spAddAuditTrail", {
    inputs: [
      { name: "actiondate", type: sql.DateTime, value: input.actionDate },
      { name: "actionby", type: sql.VarChar(50), value: input.actionBy },
      {
        name: "actiondescription",
        type: sql.VarChar(100),
        value: input.actionDescription,
      },
      { name: "actionid", type: sql.VarChar(50), value: input.actionId },
    ],
  });
}

/**
 * aaspAddAuditTrailDelete — audit entry for a delete action.
 * Demonstrates the OUTPUT-param + RETURN-value pattern (ports `isLogged`):
 * returns the log status string, or throws-style failure when RETURN != 0.
 */
export async function aaspAddAuditTrailDelete(input: {
  actionDate: Date;
  actionBy: string;
  actionDescription: string;
  actionId: string;
}): Promise<{ ok: boolean; status: string }> {
  const result = await callProcedure("aaspAddAuditTrailDelete", {
    inputs: [
      { name: "actiondate", type: sql.DateTime, value: input.actionDate },
      { name: "actionby", type: sql.VarChar(50), value: input.actionBy },
      {
        name: "actiondescription",
        type: sql.VarChar(100),
        value: input.actionDescription,
      },
      { name: "actionid", type: sql.VarChar(50), value: input.actionId },
    ],
    outputs: [{ name: "actionlogged", type: sql.VarChar(50) }],
  });

  if (result.returnValue === 0) {
    return { ok: true, status: String(result.output.actionlogged ?? "") };
  }
  return { ok: false, status: "Execution failed..." };
}

// ── Trade & payroll setup (Phase 2 — F3) ─────────────────────────────────────

/**
 * Return-code contract shared by the two effective-dated "add rate" SPs. The
 * SP closes the previous row's EndDate and inserts a new effective row.
 *   0    → saved
 *   -20  → a rate with the same effective date already exists
 *   -19  → effective date must be later than the newest existing rate
 */
export type AddRateResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "stale-date" | "unknown" };

function mapAddRateReturn(returnValue: number): AddRateResult {
  if (returnValue === 0) return { ok: true };
  if (returnValue === -20) return { ok: false, reason: "duplicate" };
  if (returnValue === -19) return { ok: false, reason: "stale-date" };
  return { ok: false, reason: "unknown" };
}

export interface TradeGroupRateInput {
  tradegroupId: number;
  dbwage: number;
  dbwageWkend: number;
  dbwageHday: number;
  hourOtimeWkday: number;
  hourOtimeWkend: number;
  hourOtimeHday: number;
  nawkday: number;
  nawkend: number;
  nahday: number;
  shiftAllowance: number;
  transport: number;
  dbwageDle: number;
  dbwageWkendDle: number;
  hourOtimeWkdayDle: number;
  hourOtimeWkendDle: number;
  nawkdayDle: number;
  nawkendDle: number;
  subsidy: number;
  ppemedical: number;
  bussing: number;
  effectiveDate: Date;
  createdBy: string;
}

/** spAddTradeGroupRate — adds a new effective-dated rate for a trade group. */
export async function spAddTradeGroupRate(
  input: TradeGroupRateInput,
): Promise<AddRateResult> {
  const num = (n: number) => ({ type: sql.Float, value: n });
  const result = await callProcedure("spAddTradeGroupRate", {
    inputs: [
      { name: "TradegroupID", type: sql.Int, value: input.tradegroupId },
      { name: "DBWage", ...num(input.dbwage) },
      { name: "DBWageWkend", ...num(input.dbwageWkend) },
      { name: "DBWageHday", ...num(input.dbwageHday) },
      { name: "HourOtimeWkday", ...num(input.hourOtimeWkday) },
      { name: "HourOtimeWkend", ...num(input.hourOtimeWkend) },
      { name: "HourOtimeHday", ...num(input.hourOtimeHday) },
      { name: "NAWkday", ...num(input.nawkday) },
      { name: "NAWkend", ...num(input.nawkend) },
      { name: "NAHday", ...num(input.nahday) },
      { name: "ShiftAllowance", ...num(input.shiftAllowance) },
      { name: "Transport", ...num(input.transport) },
      { name: "DBWageDLE", ...num(input.dbwageDle) },
      { name: "DBWageWkendDLE", ...num(input.dbwageWkendDle) },
      { name: "HourOtimeWkdayDLE", ...num(input.hourOtimeWkdayDle) },
      { name: "HourOtimeWkendDLE", ...num(input.hourOtimeWkendDle) },
      { name: "NAWkdayDLE", ...num(input.nawkdayDle) },
      { name: "NAWkendDLE", ...num(input.nawkendDle) },
      { name: "Subsidy", ...num(input.subsidy) },
      { name: "PPEMedical", ...num(input.ppemedical) },
      { name: "Bussing", ...num(input.bussing) },
      { name: "EffectiveDate", type: sql.DateTime, value: input.effectiveDate },
      { name: "CreatedBy", type: sql.VarChar(50), value: input.createdBy },
    ],
  });
  return mapAddRateReturn(result.returnValue);
}

export interface PayrollSetupInput {
  unionDues: number;
  welfare: number;
  medicals: number;
  ssfemployee: number;
  ssfemployer: number;
  providentFundEmployee: number;
  providentFundEmployer: number;
  annualBonus: number;
  annualLeave: number;
  premiumShareHolder: number;
  premiumNonShareHolder: number;
  premiumWithoutTt: number;
  taxOnBonus: number;
  taxOnBasic: number;
  taxOnOvertime: number;
  taxOnProvidentFund: number;
  taxOnTransport: number;
  onBoardAllowance: number;
  vat: number;
  getFund: number;
  nhil: number;
  taxOnNight: number;
  effectiveDate: Date;
  createdBy: string;
}

/** spAddPayrollSetup — adds a new effective-dated payroll setup row. */
export async function spAddPayrollSetup(
  input: PayrollSetupInput,
): Promise<AddRateResult> {
  const num = (n: number) => ({ type: sql.Float, value: n });
  const result = await callProcedure("spAddPayrollSetup", {
    inputs: [
      { name: "UnionDues", ...num(input.unionDues) },
      { name: "Welfare", ...num(input.welfare) },
      { name: "Medicals", ...num(input.medicals) },
      { name: "SSFemployee", ...num(input.ssfemployee) },
      { name: "SSFemployer", ...num(input.ssfemployer) },
      { name: "ProvidentFundEmployee", ...num(input.providentFundEmployee) },
      { name: "ProvidentFundEmployer", ...num(input.providentFundEmployer) },
      { name: "AnnualBonus", ...num(input.annualBonus) },
      { name: "AnnualLeave", ...num(input.annualLeave) },
      { name: "PremiumShareHolder", ...num(input.premiumShareHolder) },
      { name: "PremiumNonShareHolder", ...num(input.premiumNonShareHolder) },
      { name: "PremiumWithoutTT", ...num(input.premiumWithoutTt) },
      { name: "TaxOnBonus", ...num(input.taxOnBonus) },
      { name: "TaxOnBasic", ...num(input.taxOnBasic) },
      { name: "TaxOnOvertime", ...num(input.taxOnOvertime) },
      { name: "TaxOnProvidentFund", ...num(input.taxOnProvidentFund) },
      { name: "TaxOnTransport", ...num(input.taxOnTransport) },
      { name: "OnBoardAllowance", ...num(input.onBoardAllowance) },
      { name: "Vat", ...num(input.vat) },
      { name: "GetFund", ...num(input.getFund) },
      { name: "NHIL", ...num(input.nhil) },
      { name: "TaxOnNight", ...num(input.taxOnNight) },
      { name: "EffectiveDate", type: sql.DateTime, value: input.effectiveDate },
      { name: "CreatedBy", type: sql.VarChar(50), value: input.createdBy },
    ],
  });
  return mapAddRateReturn(result.returnValue);
}

// ── Workers (Phase 2 — F2) ───────────────────────────────────────────────────

export interface WorkerInput {
  workerId: string;
  workerType: string;
  sname: string | null;
  oname: string | null;
  pname: string | null;
  addr1: string | null;
  addr2: string | null;
  phoneNo: string | null;
  dateBirth: Date | null;
  nationalityId: number | null;
  education: string | null;
  kin: string | null;
  relation: string | null;
  kinAddr: string | null;
  kinAddrPhone: string | null;
  regDate: Date | null;
  contPer: string | null;
  contaddr: string | null;
  contPhone: string | null;
  ssfno: string | null;
  nhis: string | null;
  nat: string | null;
  shoeSize: string | null;
  height: string | null;
  tradegroupId: number | null;
  tradetypeId: number | null;
  gangId: number | null;
  bankId: number | null;
  bankBranchId: number | null;
  bankNumber: string | null;
  officialComm: string | null;
  sex: string | null;
  tax: boolean;
  chargePremium: boolean;
  ezwichid: string | null;
  nationalId: string | null;
  tin: string | null;
  departmentId: number | null;
  paymentOption: string | null;
  medicalIdNo: string | null;
  who: string;
}

/** Shared input parameters common to spAddWorker and spUpdateWorker. */
function workerInputParams(input: WorkerInput, whotime: Date) {
  const text = (n: number, v: string | null) => ({ type: sql.VarChar(n), value: v });
  return [
    { name: "WorkerID", ...text(10, input.workerId) },
    { name: "WorkerType", type: sql.Char(1), value: input.workerType },
    { name: "SName", ...text(30, input.sname) },
    { name: "OName", ...text(50, input.oname) },
    { name: "PName", ...text(50, input.pname) },
    { name: "Addr1", ...text(30, input.addr1) },
    { name: "Addr2", ...text(30, input.addr2) },
    { name: "PhoneNo", ...text(20, input.phoneNo) },
    { name: "Date_Birth", type: sql.DateTime, value: input.dateBirth },
    { name: "nationalityID", type: sql.Int, value: input.nationalityId },
    { name: "education", ...text(50, input.education) },
    { name: "Kin", ...text(30, input.kin) },
    { name: "Relation", ...text(30, input.relation) },
    { name: "KinAddr", ...text(30, input.kinAddr) },
    { name: "KinAddrPhone", ...text(20, input.kinAddrPhone) },
    { name: "RegDate", type: sql.DateTime, value: input.regDate },
    { name: "ContPer", ...text(30, input.contPer) },
    { name: "Contaddr", ...text(30, input.contaddr) },
    { name: "ContPhone", ...text(20, input.contPhone) },
    { name: "SSFNo", ...text(30, input.ssfno) },
    { name: "NHIS", ...text(30, input.nhis) },
    { name: "NAT", ...text(30, input.nat) },
    { name: "ShoeSize", type: sql.NVarChar(10), value: input.shoeSize },
    { name: "Height", type: sql.NVarChar(10), value: input.height },
    { name: "GangID", type: sql.Int, value: input.gangId },
    { name: "BankID", type: sql.Int, value: input.bankId },
    { name: "BankBranchId", type: sql.Int, value: input.bankBranchId },
    { name: "BankNumber", ...text(30, input.bankNumber) },
    { name: "OfficialComm", ...text(100, input.officialComm) },
    { name: "Sex", ...text(1, input.sex) },
    { name: "Tax", type: sql.Bit, value: input.tax },
    { name: "ChargePremium", type: sql.Bit, value: input.chargePremium },
    { name: "Pics", type: sql.Image, value: null },
    { name: "WHO", ...text(50, input.who) },
    { name: "WHOtime", type: sql.DateTime, value: whotime },
    { name: "ezwichid", ...text(50, input.ezwichid) },
    { name: "NationalID", ...text(50, input.nationalId) },
    { name: "TIN", ...text(20, input.tin) },
    { name: "DepartmentId", type: sql.Int, value: input.departmentId },
    { name: "PaymentOption", ...text(10, input.paymentOption) },
    { name: "MedicalIDNo", ...text(30, input.medicalIdNo) },
  ];
}

export interface AddWorkerResult {
  ok: boolean;
  autoId: number | null;
  gphaGroupId: string | null;
  gphaJobId: string | null;
}

/**
 * spAddWorker — inserts a worker and returns its new AutoID plus the GPHA
 * group/job ids resolved from the trade group/type. `flags` sets the initial
 * status (defaults to "NAY" — Not Approved Yet). RETURN 0 on success.
 */
export async function spAddWorker(
  input: WorkerInput & { flags: string },
): Promise<AddWorkerResult> {
  const whotime = new Date();
  const result = await callProcedure("spAddWorker", {
    inputs: [
      ...workerInputParams(input, whotime),
      { name: "TradegroupID", type: sql.Int, value: input.tradegroupId },
      { name: "TradetypeID", type: sql.Int, value: input.tradetypeId },
      { name: "flags", type: sql.VarChar(3), value: input.flags },
    ],
    outputs: [
      { name: "GPHA_GroupId", type: sql.VarChar(50) },
      { name: "GPHA_JobId", type: sql.VarChar(50) },
      { name: "AutoID", type: sql.Int },
    ],
  });
  return {
    ok: result.returnValue === 0,
    autoId: (result.output.AutoID as number | null) ?? null,
    gphaGroupId: (result.output.GPHA_GroupId as string | null) ?? null,
    gphaJobId: (result.output.GPHA_JobId as string | null) ?? null,
  };
}

/** spUpdateWorker — updates an existing worker (status is left unchanged). */
export async function spUpdateWorker(
  input: WorkerInput & { autoId: number },
): Promise<{ ok: boolean }> {
  const whotime = new Date();
  const result = await callProcedure("spUpdateWorker", {
    inputs: [
      ...workerInputParams(input, whotime),
      { name: "AutoID", type: sql.Int, value: input.autoId },
    ],
  });
  return { ok: result.returnValue === 0 };
}

/** spSetWorkerStatus — tag/untag a worker (updates flags). */
export async function spSetWorkerStatus(input: {
  workerId: string;
  flag: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spSetWorkerStatus", {
    inputs: [
      { name: "WorkerID", type: sql.VarChar(10), value: input.workerId },
      { name: "flag", type: sql.VarChar(3), value: input.flag },
    ],
  });
  return { ok: result.returnValue === 0 };
}

/** spUpdateWorkerTrade — updates a worker's trade group/type (skill). */
export async function spUpdateWorkerTrade(input: {
  workerId: string;
  tradegroupId: number;
  tradetypeId: number;
  updatedBy: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spUpdateWorkerTrade", {
    inputs: [
      { name: "WorkerID", type: sql.VarChar(10), value: input.workerId },
      { name: "TradegroupID", type: sql.Int, value: input.tradegroupId },
      { name: "TradetypeID", type: sql.Int, value: input.tradetypeId },
      { name: "UpdatedBy", type: sql.VarChar(50), value: input.updatedBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

// ── Daily requisitions (Phase 3 — F4) ────────────────────────────────────────

/** Zero time value for the unused time(0) columns the legacy app passes. */
const ZERO_TIME = new Date(1970, 0, 1, 0, 0, 0);

/** spGetNewDailyReqNo — generates the next daily requisition number for a user. */
export async function spGetNewDailyReqNo(userKey: string): Promise<string> {
  const result = await callProcedure("spGetNewDailyReqNo", {
    inputs: [{ name: "userKey", type: sql.VarChar(2), value: userKey }],
    outputs: [{ name: "DailyReqNo", type: sql.VarChar(10) }],
  });
  return String(result.output.DailyReqNo ?? "");
}

export interface DailyReqInput {
  reqNo: string;
  companyId: number;
  vesselId: number;
  locationId: number;
  reportingPointId: number;
  cargoId: number;
  gangId: number;
  jobDescription: string | null;
  gphaRequestId: string | null;
  requisitionDate: Date;
  normalHours: number;
  overtimeHours: number;
  weekend: boolean;
  shiftType: string;
  night: boolean;
  approvedDate: Date;
  preparedBy: string;
  shipSide: boolean;
}

/** Shared header params for spAddDailyReq / spUpdateDailyReq (minus ReqNo/AutoNo). */
function dailyReqParams(input: DailyReqInput) {
  return [
    { name: "DLEcodeCompanyID", type: sql.Int, value: input.companyId },
    { name: "VesselberthID", type: sql.Int, value: input.vesselId },
    { name: "locationID", type: sql.Int, value: input.locationId },
    { name: "ReportpointID", type: sql.Int, value: input.reportingPointId },
    { name: "cargoID", type: sql.Int, value: input.cargoId },
    { name: "gangID", type: sql.Int, value: input.gangId },
    { name: "job", type: sql.VarChar(50), value: input.jobDescription },
    { name: "GPHA_RequestID", type: sql.VarChar(50), value: input.gphaRequestId },
    { name: "date_", type: sql.DateTime, value: input.requisitionDate },
    { name: "Normal", type: sql.Float, value: input.normalHours },
    { name: "Overtime", type: sql.Float, value: input.overtimeHours },
    { name: "Weekends", type: sql.Bit, value: input.weekend },
    { name: "ShiftType", type: sql.VarChar(10), value: input.shiftType },
    { name: "Night", type: sql.Bit, value: input.night },
    { name: "Adate", type: sql.DateTime, value: input.approvedDate },
    { name: "Preparedby", type: sql.VarChar(50), value: input.preparedBy },
    { name: "OnBoardAllowance", type: sql.Bit, value: input.shipSide },
  ];
}

/** spAddDailyReq — creates a requisition header; returns the new AutoNo. */
export async function spAddDailyReq(
  input: DailyReqInput,
): Promise<{ ok: boolean; autoNo: number | null }> {
  const result = await callProcedure("spAddDailyReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      ...dailyReqParams(input),
      { name: "NormalHrsFrom", type: sql.Time(0), value: ZERO_TIME },
      { name: "NormalHrsTo", type: sql.Time(0), value: ZERO_TIME },
      { name: "OvertimeHrsFrom", type: sql.Time(0), value: ZERO_TIME },
      { name: "OvertimeHrsTo", type: sql.Time(0), value: ZERO_TIME },
    ],
    outputs: [{ name: "AutoNo", type: sql.Int }],
  });
  return { ok: result.returnValue === 0, autoNo: (result.output.AutoNo as number | null) ?? null };
}

/** spUpdateDailyReq — updates a requisition header (by ReqNo). */
export async function spUpdateDailyReq(input: DailyReqInput): Promise<{ ok: boolean }> {
  const result = await callProcedure("spUpdateDailyReq", {
    inputs: [...dailyReqParams(input), { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo }],
  });
  return { ok: result.returnValue === 0 };
}

/** spDeleteDailyReq — deletes a requisition (and cascades its sub-staff). */
export async function spDeleteDailyReq(input: {
  reqNo: string;
  deleteBy: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spDeleteDailyReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "DeleteBy", type: sql.VarChar(50), value: input.deleteBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

export type AddSubStaffResult =
  | { ok: true }
  | { ok: false; reason: "headman" | "unknown" };

/**
 * spAddSubStaffReq — allocates a worker to a requisition.
 *   0    → added
 *   -73  → only one Headman is permitted per requisition
 */
export async function spAddSubStaffReq(input: {
  reqNo: string;
  workerId: string;
  tradegroupId: number;
  transport: string;
  tradetypeId: number;
}): Promise<AddSubStaffResult> {
  const result = await callProcedure("spAddSubStaffReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "WorkerID", type: sql.VarChar(10), value: input.workerId },
      { name: "TradegroupID", type: sql.Int, value: input.tradegroupId },
      { name: "transport", type: sql.Char(1), value: input.transport },
      { name: "TradetypeID", type: sql.Int, value: input.tradetypeId },
    ],
  });
  if (result.returnValue === 0) return { ok: true };
  if (result.returnValue === -73) return { ok: false, reason: "headman" };
  return { ok: false, reason: "unknown" };
}

/** spToogleWorkerTransport — flips the transport flag ('*' ⇄ '') for an allocation. */
export async function spToogleWorkerTransport(input: {
  autoId: number;
  transport: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spToogleWorkerTransport", {
    inputs: [
      { name: "AutoId", type: sql.Int, value: input.autoId },
      { name: "transport", type: sql.Char(1), value: input.transport },
    ],
  });
  return { ok: result.returnValue === 0 };
}

/**
 * spUpdateDailyReqHours — sets Normal/Overtime hours on a cost sheet.
 *   -20 → requisition is already approved (cannot change hours)
 */
export async function spUpdateDailyReqHours(input: {
  reqNo: string;
  normal: number;
  overtime: number;
  hourBy: string;
  hourDate: Date;
}): Promise<{ ok: boolean; approved: boolean }> {
  const result = await callProcedure("spUpdateDailyReqHours", {
    inputs: [
      { name: "Normal", type: sql.Float, value: input.normal },
      { name: "Overtime", type: sql.Float, value: input.overtime },
      { name: "Hourby", type: sql.VarChar(50), value: input.hourBy },
      { name: "HourDate", type: sql.DateTime, value: input.hourDate },
      { name: "NormalHrsFrom", type: sql.Time(0), value: ZERO_TIME },
      { name: "NormalHrsTo", type: sql.Time(0), value: ZERO_TIME },
      { name: "OvertimeHrsFrom", type: sql.Time(0), value: ZERO_TIME },
      { name: "OvertimeHrsTo", type: sql.Time(0), value: ZERO_TIME },
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
    ],
  });
  return { ok: result.returnValue === 0, approved: result.returnValue === -20 };
}

// ── GPHA cost sheet from a CLMS request (Phase 4 — F5) ───────────────────────

/**
 * spAddDailyReq_GPHARequest — creates a GDLC daily requisition (cost sheet) from
 * a GPHA labour request and links it back (CostSheetNo/hasCostSheet). Normal/
 * Overtime start at 0 and Adate is the unapproved sentinel — both set by the SP.
 *   0   → saved
 *   -23 → this GPHA Request ID already has a cost sheet
 */
export async function spAddDailyReqGphaRequest(input: {
  reqNo: string;
  companyId: number;
  vesselId: number;
  locationId: number;
  reportingPointId: number;
  cargoId: number;
  gangId: number;
  jobDescription: string | null;
  gphaRequestId: string | null;
  requisitionDate: Date;
  weekend: boolean;
  shiftType: string;
  night: boolean;
  preparedBy: string;
  shipSide: boolean;
}): Promise<{ ok: boolean; duplicate: boolean }> {
  const result = await callProcedure("spAddDailyReq_GPHARequest", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "DLEcodeCompanyID", type: sql.Int, value: input.companyId },
      { name: "VesselberthID", type: sql.Int, value: input.vesselId },
      { name: "locationID", type: sql.Int, value: input.locationId },
      { name: "ReportpointID", type: sql.Int, value: input.reportingPointId },
      { name: "cargoID", type: sql.Int, value: input.cargoId },
      { name: "gangID", type: sql.Int, value: input.gangId },
      { name: "job", type: sql.VarChar(50), value: input.jobDescription },
      { name: "GPHA_RequestID", type: sql.VarChar(50), value: input.gphaRequestId },
      { name: "date_", type: sql.DateTime, value: input.requisitionDate },
      { name: "Weekends", type: sql.Bit, value: input.weekend },
      { name: "ShiftType", type: sql.VarChar(10), value: input.shiftType },
      { name: "Night", type: sql.Bit, value: input.night },
      { name: "Preparedby", type: sql.VarChar(50), value: input.preparedBy },
      { name: "OnBoardAllowance", type: sql.Bit, value: input.shipSide },
    ],
  });
  return { ok: result.returnValue === 0, duplicate: result.returnValue === -23 };
}

// ── Approvals (Phase 5 — F7) ─────────────────────────────────────────────────
// Approve/disapprove share the same shape across daily/weekly/monthly; only the
// procedure name differs. RETURN 0 on success in every case.

async function approveReq(
  proc: string,
  input: { reqNo: string; adate: Date; approvedBy: string },
): Promise<{ ok: boolean }> {
  const result = await callProcedure(proc, {
    inputs: [
      { name: "Adate", type: sql.DateTime, value: input.adate },
      { name: "Approvedby", type: sql.VarChar(50), value: input.approvedBy },
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
    ],
  });
  return { ok: result.returnValue === 0 };
}

async function disapproveReq(
  proc: string,
  input: { reqNo: string; disapprovedBy: string; processed: boolean },
): Promise<{ ok: boolean }> {
  const result = await callProcedure(proc, {
    inputs: [
      { name: "Processed", type: sql.Bit, value: input.processed },
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "DisApprovedBy", type: sql.VarChar(50), value: input.disapprovedBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

export const spApproveDailyReq = (i: { reqNo: string; adate: Date; approvedBy: string }) =>
  approveReq("spApproveDailyReq", i);
export const spDisapproveDailyReq = (i: { reqNo: string; disapprovedBy: string; processed: boolean }) =>
  disapproveReq("spDisapproveDailyReq", i);
export const spApproveWeeklyReq = (i: { reqNo: string; adate: Date; approvedBy: string }) =>
  approveReq("spApproveWeeklyReq", i);
export const spDisapproveWeeklyReq = (i: { reqNo: string; disapprovedBy: string; processed: boolean }) =>
  disapproveReq("spDisapproveWeeklyReq", i);
export const spApproveMonthlyReq = (i: { reqNo: string; adate: Date; approvedBy: string }) =>
  approveReq("spApproveMonthlyReq", i);
export const spDisapproveMonthlyReq = (i: { reqNo: string; disapprovedBy: string; processed: boolean }) =>
  disapproveReq("spDisapproveMonthlyReq", i);

/** spConfirmWeeklyReq / spConfirmMonthlyReq — mark a requisition confirmed. */
async function confirmReq(proc: string, input: { reqNo: string; confirmedBy: string }): Promise<{ ok: boolean }> {
  const result = await callProcedure(proc, {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "ConfirmedBy", type: sql.VarChar(50), value: input.confirmedBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}
export const spConfirmWeeklyReq = (i: { reqNo: string; confirmedBy: string }) =>
  confirmReq("spConfirmWeeklyReq", i);
export const spConfirmMonthlyReq = (i: { reqNo: string; confirmedBy: string }) =>
  confirmReq("spConfirmMonthlyReq", i);

// ── Monthly requisitions (Phase 5 — F6) ──────────────────────────────────────

export interface MonthlyReqInput {
  reqNo: string;
  companyId: number;
  workerId: string;
  tradegroupId: number;
  tradetypeId: number;
  reportingPointId: number;
  locationId: number;
  jobDescription: string | null;
  requisitionDate: Date;
  preparedBy: string;
  dwkday: number;
  dwkend: number;
  dtotal: number;
  hrwkday: number;
  hrwkend: number;
  nwkday: number;
  nwkend: number;
  yyyymm: string;
  periodStart: Date;
  periodEnd: Date;
}

function monthlyParams(input: MonthlyReqInput) {
  return [
    { name: "DLEcodeCompanyID", type: sql.Int, value: input.companyId },
    { name: "WorkerID", type: sql.VarChar(10), value: input.workerId },
    { name: "TradegroupID", type: sql.Int, value: input.tradegroupId },
    { name: "TradetypeID", type: sql.Int, value: input.tradetypeId },
    { name: "ReportpointID", type: sql.Int, value: input.reportingPointId },
    { name: "locationID", type: sql.Int, value: input.locationId },
    { name: "job", type: sql.VarChar(50), value: input.jobDescription },
    { name: "date_", type: sql.DateTime, value: input.requisitionDate },
    { name: "Preparedby", type: sql.VarChar(50), value: input.preparedBy },
    { name: "DWkday", type: sql.Int, value: input.dwkday },
    { name: "DWkend", type: sql.Int, value: input.dwkend },
    { name: "DTotal", type: sql.Int, value: input.dtotal },
    { name: "HRWkday", type: sql.Float, value: input.hrwkday },
    { name: "HRWkend", type: sql.Float, value: input.hrwkend },
    { name: "NWkday", type: sql.Int, value: input.nwkday },
    { name: "NWkend", type: sql.Int, value: input.nwkend },
    { name: "Yyyymm", type: sql.VarChar(6), value: input.yyyymm },
    { name: "PeriodStart", type: sql.DateTime, value: input.periodStart },
    { name: "PeriodEnd", type: sql.DateTime, value: input.periodEnd },
  ];
}

export async function spGetNewMonthlyReqNo(userKey: string): Promise<string> {
  const result = await callProcedure("spGetNewMonthlyReqNo", {
    inputs: [{ name: "userKey", type: sql.VarChar(2), value: userKey }],
    outputs: [{ name: "MonthlyReqNo", type: sql.VarChar(10) }],
  });
  return String(result.output.MonthlyReqNo ?? "");
}

export async function spAddMonthlyReq(
  input: MonthlyReqInput,
): Promise<{ ok: boolean; autoNo: number | null }> {
  const result = await callProcedure("spAddMonthlyReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "Adate", type: sql.DateTime, value: new Date() },
      ...monthlyParams(input),
    ],
    outputs: [{ name: "AutoNo", type: sql.Int }],
  });
  return { ok: result.returnValue === 0, autoNo: (result.output.AutoNo as number | null) ?? null };
}

export async function spUpdateMonthlyReq(input: MonthlyReqInput): Promise<{ ok: boolean }> {
  const result = await callProcedure("spUpdateMonthlyReq", {
    inputs: [...monthlyParams(input), { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo }],
  });
  return { ok: result.returnValue === 0 };
}

export async function spDeleteMonthlyReq(input: { reqNo: string; deleteBy: string }): Promise<{ ok: boolean }> {
  const result = await callProcedure("spDeleteMonthlyReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "DeleteBy", type: sql.VarChar(50), value: input.deleteBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

// ── Weekly requisitions (Phase 5 — F6) ───────────────────────────────────────

export interface WeeklyReqInput {
  reqNo: string;
  companyId: number;
  workerId: string;
  tradegroupId: number;
  tradetypeId: number;
  reportingPointId: number;
  locationId: number;
  jobDescription: string | null;
  requisitionDate: Date;
  preparedBy: string;
}

function weeklyParams(input: WeeklyReqInput) {
  return [
    { name: "DLEcodeCompanyID", type: sql.Int, value: input.companyId },
    { name: "WorkerID", type: sql.VarChar(10), value: input.workerId },
    { name: "TradegroupID", type: sql.Int, value: input.tradegroupId },
    { name: "TradetypeID", type: sql.Int, value: input.tradetypeId },
    { name: "ReportpointID", type: sql.Int, value: input.reportingPointId },
    { name: "locationID", type: sql.Int, value: input.locationId },
    { name: "job", type: sql.VarChar(50), value: input.jobDescription },
    { name: "date_", type: sql.DateTime, value: input.requisitionDate },
    { name: "Preparedby", type: sql.VarChar(50), value: input.preparedBy },
  ];
}

export async function spGetNewWeeklyReqNo(userKey: string): Promise<string> {
  const result = await callProcedure("spGetNewWeeklyReqNo", {
    inputs: [{ name: "userKey", type: sql.VarChar(2), value: userKey }],
    outputs: [{ name: "WeeklyReqNo", type: sql.VarChar(10) }],
  });
  return String(result.output.WeeklyReqNo ?? "");
}

export async function spAddWeeklyReq(
  input: WeeklyReqInput,
): Promise<{ ok: boolean; autoNo: number | null }> {
  const result = await callProcedure("spAddWeeklyReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "Adate", type: sql.DateTime, value: new Date() },
      ...weeklyParams(input),
    ],
    outputs: [{ name: "AutoNo", type: sql.Int }],
  });
  return { ok: result.returnValue === 0, autoNo: (result.output.AutoNo as number | null) ?? null };
}

export async function spUpdateWeeklyReq(input: WeeklyReqInput): Promise<{ ok: boolean }> {
  const result = await callProcedure("spUpdateWeeklyReq", {
    inputs: [...weeklyParams(input), { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo }],
  });
  return { ok: result.returnValue === 0 };
}

export async function spDeleteWeeklyReq(input: { reqNo: string; deleteBy: string }): Promise<{ ok: boolean }> {
  const result = await callProcedure("spDeleteWeeklyReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "DeleteBy", type: sql.VarChar(50), value: input.deleteBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

export interface WorkDayInput {
  transDate: Date;
  normal: number;
  overtime: number;
  night: string;
  weekends: string;
  holiday: string;
  shiftType: string;
  remarks: string;
  vesselberthId: number;
  onBoardAllowance: boolean;
}

/** spAddSubStaffWReq — adds a work day to a weekly requisition. */
export async function spAddSubStaffWReq(
  input: WorkDayInput & { reqNo: string; transport: string },
): Promise<{ ok: boolean; paidReqNo: string }> {
  const result = await callProcedure("spAddSubStaffWReq", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "TransDate", type: sql.DateTime, value: input.transDate },
      { name: "Normal", type: sql.Float, value: input.normal },
      { name: "Overtime", type: sql.Float, value: input.overtime },
      { name: "Night", type: sql.VarChar(5), value: input.night },
      { name: "Weekends", type: sql.VarChar(7), value: input.weekends },
      { name: "Holiday", type: sql.VarChar(7), value: input.holiday },
      { name: "ShiftType", type: sql.VarChar(10), value: input.shiftType },
      { name: "Remarks", type: sql.VarChar(50), value: input.remarks },
      { name: "VesselberthID", type: sql.Int, value: input.vesselberthId },
      { name: "Transport", type: sql.Char(1), value: input.transport },
      { name: "OnBoardAllowance", type: sql.Bit, value: input.onBoardAllowance },
    ],
    outputs: [{ name: "paidReqNo", type: sql.VarChar(10) }],
  });
  return { ok: result.returnValue === 0, paidReqNo: String(result.output.paidReqNo ?? "") };
}

/** spUpdateSubStaffWReq — updates a work day. */
export async function spUpdateSubStaffWReq(
  input: WorkDayInput & { autoId: number },
): Promise<{ ok: boolean }> {
  const result = await callProcedure("spUpdateSubStaffWReq", {
    inputs: [
      { name: "TransDate", type: sql.DateTime, value: input.transDate },
      { name: "Normal", type: sql.Float, value: input.normal },
      { name: "Overtime", type: sql.Float, value: input.overtime },
      { name: "Night", type: sql.VarChar(5), value: input.night },
      { name: "Weekends", type: sql.VarChar(7), value: input.weekends },
      { name: "Holiday", type: sql.VarChar(7), value: input.holiday },
      { name: "ShiftType", type: sql.VarChar(10), value: input.shiftType },
      { name: "Remarks", type: sql.VarChar(50), value: input.remarks },
      { name: "VesselberthID", type: sql.Int, value: input.vesselberthId },
      { name: "OnBoardAllowance", type: sql.Bit, value: input.onBoardAllowance },
      { name: "autoId", type: sql.Int, value: input.autoId },
    ],
  });
  return { ok: result.returnValue === 0 };
}

/** spToogleWorkDayTransport — flips the transport flag for a work day. */
export async function spToogleWorkDayTransport(input: {
  autoId: number;
  transport: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spToogleWorkDayTransport", {
    inputs: [
      { name: "AutoId", type: sql.Int, value: input.autoId },
      { name: "transport", type: sql.Char(1), value: input.transport },
    ],
  });
  return { ok: result.returnValue === 0 };
}

/** spAllowWeeklyReqDuplicateShift — permits a duplicate shift on a weekly req. */
export async function spAllowWeeklyReqDuplicateShift(input: {
  reqNo: string;
  approvedBy: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spAllowWeeklyReqDuplicateShift", {
    inputs: [
      { name: "ReqNo", type: sql.VarChar(10), value: input.reqNo },
      { name: "Approvedby", type: sql.VarChar(50), value: input.approvedBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

// ── Payroll process / store / delete-stored (Phase 6 — F8) ───────────────────
// Every one of these SPs takes @startdate/@enddate + a "by" param and returns
// the affected cost-sheet count via an OUTPUT param + a RETURN value. Only the
// procedure name, the "by" param name, and the count OUTPUT name differ.

export interface PayrollRangeInput {
  startDate: Date;
  endDate: Date;
  actor: string;
}

export interface PayrollResult {
  /** Number of cost sheets processed/stored/deleted (OUTPUT param). */
  costSheets: number;
  /** RETURN value (0 = success). */
  returnValue: number;
}

async function runPayroll(
  proc: string,
  byParam: string,
  countParam: string,
  input: PayrollRangeInput,
): Promise<PayrollResult> {
  const result = await callProcedure(proc, {
    inputs: [
      { name: "startdate", type: sql.DateTime, value: input.startDate },
      { name: "enddate", type: sql.DateTime, value: input.endDate },
      { name: byParam, type: sql.VarChar(50), value: input.actor },
    ],
    outputs: [{ name: countParam, type: sql.Int }],
  });
  return {
    costSheets: (result.output[countParam] as number | null) ?? 0,
    returnValue: result.returnValue,
  };
}

// Process approved requisitions → cost sheets.
export const spProcessDailyReq = (i: PayrollRangeInput) =>
  runPayroll("spProcessDailyReq", "processedby", "processedCostSheets", i);
export const spProcessWeeklyReq = (i: PayrollRangeInput) =>
  runPayroll("spProcessWeeklyReq", "processedby", "processedCostSheets", i);
export const spProcessMonthlyReq = (i: PayrollRangeInput) =>
  runPayroll("spProcessMonthlyReq", "processedby", "processedCostSheets", i);

// Store / archive processed cost sheets.
export const spStoreDailyReq = (i: PayrollRangeInput) =>
  runPayroll("spStoreDailyReq", "storedby", "storedCostSheets", i);
export const spStoreWeeklyReq = (i: PayrollRangeInput) =>
  runPayroll("spStoreWeeklyReq", "storedby", "storedCostSheets", i);
export const spStoreMonthlyReq = (i: PayrollRangeInput) =>
  runPayroll("spStoreMonthlyReq", "storedby", "storedCostSheets", i);

// Delete stored cost sheets (weekly/monthly only — no daily delete-stored SP).
export const spDeleteStoredWeeklyReq = (i: PayrollRangeInput) =>
  runPayroll("spDeleteStoredWeeklyReq", "deletedby", "deletedstoredCostSheets", i);
export const spDeleteStoredMonthlyReq = (i: PayrollRangeInput) =>
  runPayroll("spDeleteStoredMonthlyReq", "deletedby", "deletedstoredCostSheets", i);

// ── Loans (Phase 7 — F9) ─────────────────────────────────────────────────────

export type AddLoanResult =
  | { ok: true; loanNo: string }
  | { ok: false; reason: "pending-scheme" | "pending-any" | "unknown" };

/**
 * spAddLoan — creates a loan and returns the generated LoanNo (OUTPUT).
 *   0    → created
 *   -19  → worker has a pending loan on the same scheme
 *   -27  → worker has a pending loan (cannot take any more)
 */
export async function spAddLoan(input: {
  workerId: string;
  loanSchemeId: number;
  loanDate: Date;
  loanAmount: number;
  repayAmount: number;
  monthlyLimit: number;
  autoDeduct: boolean;
  createdBy: string;
}): Promise<AddLoanResult> {
  const result = await callProcedure("spAddLoan", {
    inputs: [
      { name: "WorkerId", type: sql.VarChar(10), value: input.workerId },
      { name: "LoanSchemeId", type: sql.Int, value: input.loanSchemeId },
      { name: "LoanDate", type: sql.DateTime, value: input.loanDate },
      { name: "LoanAmount", type: sql.Float, value: input.loanAmount },
      { name: "RepayAmount", type: sql.Float, value: input.repayAmount },
      { name: "MonthlyLimit", type: sql.Float, value: input.monthlyLimit },
      { name: "AutoDeduct", type: sql.Bit, value: input.autoDeduct },
      { name: "CreatedBy", type: sql.VarChar(50), value: input.createdBy },
    ],
    outputs: [{ name: "LoanNo", type: sql.VarChar(20) }],
  });
  if (result.returnValue === 0) return { ok: true, loanNo: String(result.output.LoanNo ?? "") };
  if (result.returnValue === -19) return { ok: false, reason: "pending-scheme" };
  if (result.returnValue === -27) return { ok: false, reason: "pending-any" };
  return { ok: false, reason: "unknown" };
}

/** spUpdateLoan — updates an unapproved loan (by LoanNo). RETURN 0 on success. */
export async function spUpdateLoan(input: {
  loanNo: string;
  workerId: string;
  loanSchemeId: number;
  loanDate: Date;
  loanAmount: number;
  repayAmount: number;
  monthlyLimit: number;
  repaidAmount: number;
  autoDeduct: boolean;
  updatedBy: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spUpdateLoan", {
    inputs: [
      { name: "LoanNo", type: sql.VarChar(20), value: input.loanNo },
      { name: "WorkerId", type: sql.VarChar(10), value: input.workerId },
      { name: "LoanSchemeId", type: sql.Int, value: input.loanSchemeId },
      { name: "LoanDate", type: sql.DateTime, value: input.loanDate },
      { name: "LoanAmount", type: sql.Float, value: input.loanAmount },
      { name: "RepayAmount", type: sql.Float, value: input.repayAmount },
      { name: "MonthlyLimit", type: sql.Float, value: input.monthlyLimit },
      { name: "RepaidAmount", type: sql.Float, value: input.repaidAmount },
      { name: "AutoDeduct", type: sql.Bit, value: input.autoDeduct },
      { name: "UpdatedBy", type: sql.VarChar(50), value: input.updatedBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

/** spApproveLoan — approves a loan. RETURN 0 on success. */
export async function spApproveLoan(input: {
  loanNo: string;
  approvedDate: Date;
  approvedBy: string;
}): Promise<{ ok: boolean }> {
  const result = await callProcedure("spApproveLoan", {
    inputs: [
      { name: "loanNo", type: sql.VarChar(20), value: input.loanNo },
      { name: "approvedDate", type: sql.DateTime, value: input.approvedDate },
      { name: "approvedBy", type: sql.VarChar(50), value: input.approvedBy },
    ],
  });
  return { ok: result.returnValue === 0 };
}

export type AddRepaymentResult =
  | { ok: true }
  | { ok: false; reason: "duplicate-receipt" | "unknown" };

/**
 * spAddLoanRepayment — records a repayment.
 *   0    → saved
 *   -20  → the manual receipt number has already been used
 */
export async function spAddLoanRepayment(input: {
  loanNo: string;
  workerId: string;
  repayDate: Date;
  repayAmount: number;
  manualReceiptNo: string;
  createdBy: string;
}): Promise<AddRepaymentResult> {
  const result = await callProcedure("spAddLoanRepayment", {
    inputs: [
      { name: "LoanNo", type: sql.VarChar(20), value: input.loanNo },
      { name: "WorkerId", type: sql.VarChar(10), value: input.workerId },
      { name: "RepayDate", type: sql.DateTime, value: input.repayDate },
      { name: "RepayAmount", type: sql.Float, value: input.repayAmount },
      { name: "ManualReceiptNo", type: sql.VarChar(50), value: input.manualReceiptNo },
      { name: "CreatedBy", type: sql.VarChar(50), value: input.createdBy },
    ],
  });
  if (result.returnValue === 0) return { ok: true };
  if (result.returnValue === -20) return { ok: false, reason: "duplicate-receipt" };
  return { ok: false, reason: "unknown" };
}

/**
 * spApproveLoanRepayment — approves a repayment; returns the loan's new repaid
 * amount + balance (OUTPUT). RETURN 0 on success.
 */
export async function spApproveLoanRepayment(input: {
  autoId: number;
  loanNo: string;
  approvedBy: string;
}): Promise<{ ok: boolean; repaidAmount: number; loanBalance: number }> {
  const result = await callProcedure("spApproveLoanRepayment", {
    inputs: [
      { name: "AutoId", type: sql.Int, value: input.autoId },
      { name: "LoanNo", type: sql.VarChar(20), value: input.loanNo },
      { name: "ApprovedBy", type: sql.VarChar(50), value: input.approvedBy },
    ],
    outputs: [
      { name: "LoanRepaidAmount", type: sql.Float },
      { name: "LoanBalance", type: sql.Float },
    ],
  });
  return {
    ok: result.returnValue === 0,
    repaidAmount: (result.output.LoanRepaidAmount as number | null) ?? 0,
    loanBalance: (result.output.LoanBalance as number | null) ?? 0,
  };
}

/** spDeleteLoanRepayment — deletes an unapproved repayment. RETURN 0 on success. */
export async function spDeleteLoanRepayment(autoId: number): Promise<{ ok: boolean }> {
  const result = await callProcedure("spDeleteLoanRepayment", {
    inputs: [{ name: "AutoId", type: sql.Int, value: autoId }],
  });
  return { ok: result.returnValue === 0 };
}
