import "server-only";

import { notFound } from "next/navigation";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { spGetNewMonthlyReqNo } from "@/db/procedures";
import { MonthlyEditor, type MonthlyInitial } from "./monthly-editor";
import {
  getMonthlyReq,
  listCompanyOptions,
  listReportingPointOptions,
  listLocationOptions,
} from "./queries";
import { startOfDay, todayInput } from "@/lib/date";

async function loadOptions() {
  const [companies, reportingPoints, locations] = await Promise.all([
    listCompanyOptions(),
    listReportingPointOptions(),
    listLocationOptions(),
  ]);
  return { companies, reportingPoints, locations };
}

function emptyInitial(requestNo: string): MonthlyInitial {
  // The default period is the calendar month of the user's today, built on the
  // UTC clock so it can't roll into the neighbouring month once stored (these
  // are tz-less calendar dates — see src/lib/date.ts).
  const today = startOfDay(todayInput());
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const yyyymm = `${year}${String(month + 1).padStart(2, "0")}`;
  return {
    requestNo,
    companyId: 0,
    workerId: "",
    workerName: "",
    tradegroupId: 0,
    tradegroupName: null,
    tradetypeId: 0,
    tradetypeName: null,
    reportingPointId: 0,
    locationId: 0,
    jobDescription: null,
    requisitionDate: today,
    yyyymm,
    periodStart: start,
    periodEnd: end,
    dwkday: 0,
    dwkend: 0,
    dtotal: 0,
    hrwkday: 0,
    hrwkend: 0,
    nwkday: 0,
    nwkend: 0,
    approved: false,
    confirmed: false,
  };
}

export async function MonthlyReqPage({ reqNo }: { reqNo?: string }) {
  const isEdit = !!reqNo;
  const user = await requirePermissionOrRedirect(isEdit ? P.MonthlyReq.View : P.MonthlyReq.Create);
  const options = await loadOptions();

  if (!isEdit) {
    const newReqNo = user.userKey ? await spGetNewMonthlyReqNo(user.userKey) : "";
    return (
      <div className="space-y-6">
        <PageHeader title="New Monthly Requisition" breadcrumb="Operations" />
        <MonthlyEditor mode="create" initial={emptyInitial(newReqNo)} options={options} canSave />
      </div>
    );
  }

  const req = await getMonthlyReq(reqNo);
  if (!req) notFound();
  const canEdit = await hasPermission(user.id, P.MonthlyReq.Edit);

  return (
    <div className="space-y-6">
      <PageHeader title={`Monthly Requisition — ${req.requestNo}`} breadcrumb="Operations" />
      <MonthlyEditor mode="edit" initial={req} options={options} canSave={canEdit} />
    </div>
  );
}
