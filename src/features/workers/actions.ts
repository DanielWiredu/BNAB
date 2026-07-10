"use server";

import { revalidatePath } from "next/cache";

import { workerSchema, skillSchema, statusSchema } from "./schema";
import {
  listTradeTypeOptions,
  listBankBranchOptions,
  type Option,
} from "./queries";
import {
  spAddWorker,
  spUpdateWorker,
  spSetWorkerStatus,
  spUpdateWorkerTrade,
  type WorkerInput as SpWorkerInput,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionResultData<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function authorize(permission: string): Promise<
  { ok: true; actor: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  const actor = (user.userKey || user.name || user.email || user.id).slice(0, 50);
  return { ok: true, actor };
}

/** Map validated form values → the shared spAddWorker/spUpdateWorker input. */
function toSpInput(
  v: import("zod").infer<typeof workerSchema>,
  who: string,
): SpWorkerInput {
  return {
    workerId: v.workerId,
    workerType: v.workerType,
    sname: v.surname,
    oname: v.otherNames,
    pname: v.previousName,
    addr1: v.address1,
    addr2: v.address2,
    phoneNo: v.phoneNumber,
    dateBirth: v.dateOfBirth,
    nationalityId: v.nationalityId,
    education: v.education,
    kin: v.nextOfKin,
    relation: v.nokRelation,
    kinAddr: v.nokAddress,
    kinAddrPhone: v.nokPhoneNo,
    regDate: v.registrationDate,
    contPer: v.contactPerson,
    contaddr: v.contactAddress,
    contPhone: v.contactPhone,
    ssfno: v.ssfNo,
    nhis: v.nhisRegNo,
    nat: v.newIdNo,
    shoeSize: v.shoeSize,
    height: v.height,
    tradegroupId: v.tradeGroupId,
    tradetypeId: v.tradeTypeId,
    gangId: v.gangId,
    bankId: v.bankId,
    bankBranchId: v.bankBranchId,
    bankNumber: v.bankAccountNumber,
    officialComm: v.notes,
    sex: v.gender,
    tax: v.tax,
    chargePremium: v.chargePremium,
    ezwichid: v.ezwichNo,
    nationalId: v.nationalIdNo,
    tin: v.tin,
    departmentId: v.departmentId,
    paymentOption: v.paymentOption,
    medicalIdNo: v.medicalIdNo,
    who,
  };
}

export async function createWorker(
  values: unknown,
): Promise<ActionResultData<{ autoId: number | null }>> {
  const auth = await authorize(P.Workers.Create);
  if (!auth.ok) return auth;

  const parsed = workerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    // New workers start as "Not Approved Yet" (matches the form default).
    const result = await spAddWorker({ ...toSpInput(parsed.data, auth.actor), flags: "NAY" });
    if (!result.ok) return { ok: false, error: "Could not register the worker." };
    await logAction("ADD Worker", parsed.data.workerId);
    revalidatePath("/workers/registration");
    return { ok: true, data: { autoId: result.autoId } };
  } catch (err) {
    logger.error({ err }, "createWorker failed");
    return { ok: false, error: "Could not register the worker. The Worker ID may already exist." };
  }
}

export async function updateWorker(autoId: number, values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Workers.Edit);
  if (!auth.ok) return auth;

  const parsed = workerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await spUpdateWorker({ ...toSpInput(parsed.data, auth.actor), autoId });
    if (!result.ok) return { ok: false, error: "Could not update the worker." };
    await logAction("EDIT Worker", parsed.data.workerId);
    revalidatePath("/workers/registration");
    revalidatePath(`/workers/registration/${parsed.data.workerId}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, autoId }, "updateWorker failed");
    return { ok: false, error: "Could not update the worker. Please try again." };
  }
}

export async function updateWorkerSkill(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Workers.Edit);
  if (!auth.ok) return auth;

  const parsed = skillSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await spUpdateWorkerTrade({
      workerId: parsed.data.workerId,
      tradegroupId: parsed.data.tradeGroupId,
      tradetypeId: parsed.data.tradeTypeId,
      updatedBy: auth.actor,
    });
    if (!result.ok) return { ok: false, error: "Could not update the skill." };
    await logAction("UPDATE Worker Skill", parsed.data.workerId);
    revalidatePath(`/workers/registration/${parsed.data.workerId}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateWorkerSkill failed");
    return { ok: false, error: "Could not update the skill. Please try again." };
  }
}

export async function setWorkerStatus(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Workers.TagUntag);
  if (!auth.ok) return auth;

  const parsed = statusSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await spSetWorkerStatus({
      workerId: parsed.data.workerId,
      flag: parsed.data.flag,
    });
    if (!result.ok) return { ok: false, error: "Status update failed." };
    await logAction(`TAG/UNTAG Worker ${parsed.data.flag}`, parsed.data.workerId);
    revalidatePath("/tools/tag-untag");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "setWorkerStatus failed");
    return { ok: false, error: "Status update failed. Please try again." };
  }
}

// ── Cascading option fetchers (read-only; require an authenticated viewer) ────

export async function fetchTradeTypeOptions(tradeGroupId: number): Promise<Option[]> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.Workers.View))) return [];
  return listTradeTypeOptions(tradeGroupId);
}

export async function fetchBankBranchOptions(bankId: number): Promise<Option[]> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.Workers.View))) return [];
  return listBankBranchOptions(bankId);
}
