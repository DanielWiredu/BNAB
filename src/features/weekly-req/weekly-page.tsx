import "server-only";

import { notFound } from "next/navigation";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { spGetNewWeeklyReqNo } from "@/db/procedures";
import { WeeklyEditor, type WeeklyInitial } from "./weekly-editor";
import {
  getWeeklyReq,
  listWorkDays,
  listCompanyOptions,
  listReportingPointOptions,
  listLocationOptions,
  listVesselOptions,
} from "./queries";

async function loadOptions() {
  const [companies, reportingPoints, locations, vessels] = await Promise.all([
    listCompanyOptions(),
    listReportingPointOptions(),
    listLocationOptions(),
    listVesselOptions(),
  ]);
  return { companies, reportingPoints, locations, vessels };
}

function emptyInitial(requestNo: string): WeeklyInitial {
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
    requisitionDate: new Date(),
    approved: false,
    confirmed: false,
  };
}

export async function WeeklyReqPage({ reqNo }: { reqNo?: string }) {
  const isEdit = !!reqNo;
  const user = await requirePermissionOrRedirect(isEdit ? P.WeeklyReq.View : P.WeeklyReq.Create);
  const options = await loadOptions();

  if (!isEdit) {
    const newReqNo = user.userKey ? await spGetNewWeeklyReqNo(user.userKey) : "";
    return (
      <div className="space-y-6">
        <PageHeader title="New Weekly Requisition" breadcrumb="Operations" />
        <WeeklyEditor mode="create" initial={emptyInitial(newReqNo)} options={options} workDays={[]} canSave />
      </div>
    );
  }

  const req = await getWeeklyReq(reqNo);
  if (!req) notFound();
  const [workDays, canEdit] = await Promise.all([
    listWorkDays(req.requestNo),
    hasPermission(user.id, P.WeeklyReq.Edit),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Weekly Requisition — ${req.requestNo}`} breadcrumb="Operations" />
      <WeeklyEditor mode="edit" initial={req} options={options} workDays={workDays} canSave={canEdit} />
    </div>
  );
}
