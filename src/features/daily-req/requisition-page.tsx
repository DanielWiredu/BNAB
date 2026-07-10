import "server-only";

import { notFound } from "next/navigation";

import { requirePermissionOrRedirect, getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { spGetNewDailyReqNo } from "@/db/procedures";
import { RequisitionEditor, type RequisitionInitial } from "./requisition-editor";
import {
  getDailyReq,
  listSubStaff,
  listCompanyOptions,
  listVesselOptions,
  listReportingPointOptions,
  listLocationOptions,
  listCargoOptions,
  listGangOptions,
} from "./queries";

async function loadOptions() {
  const [companies, vessels, reportingPoints, locations, cargos, gangs] = await Promise.all([
    listCompanyOptions(),
    listVesselOptions(),
    listReportingPointOptions(),
    listLocationOptions(),
    listCargoOptions(),
    listGangOptions(),
  ]);
  return { companies, vessels, reportingPoints, locations, cargos, gangs };
}

const EMPTY_INITIAL = (requestNo: string): RequisitionInitial => ({
  requestNo,
  companyId: 0,
  vesselId: 0,
  reportingPointId: 0,
  locationId: 0,
  cargoId: 0,
  gangId: 0,
  requisitionDate: new Date(),
  jobDescription: null,
  gphaRequestId: null,
  shiftType: "Non-Shift",
  shipSide: false,
  weekend: false,
  night: false,
  normalHours: 0,
  overtimeHours: 0,
  approved: false,
  autoNo: 0,
});

/** Renders the daily requisition editor for create (new ReqNo) or edit modes. */
export async function RequisitionPage({ reqNo }: { reqNo?: string }) {
  const isEdit = !!reqNo;
  const user = await requirePermissionOrRedirect(isEdit ? P.DailyReq.View : P.DailyReq.Create);
  const options = await loadOptions();

  if (!isEdit) {
    const newReqNo = user.userKey ? await spGetNewDailyReqNo(user.userKey) : "";
    return (
      <div className="space-y-6">
        <PageHeader title="New Daily Requisition" breadcrumb="Operations" />
        <RequisitionEditor mode="create" initial={EMPTY_INITIAL(newReqNo)} options={options} subStaff={[]} canSave />
      </div>
    );
  }

  const req = await getDailyReq(reqNo);
  if (!req) notFound();

  const [subStaff, canEdit] = await Promise.all([
    listSubStaff(req.reqNo),
    hasPermission(user.id, P.DailyReq.Edit),
  ]);

  const initial: RequisitionInitial = {
    requestNo: req.reqNo,
    companyId: req.dlecodeCompanyId,
    vesselId: req.vesselberthId ?? 0,
    reportingPointId: req.reportpointId ?? 0,
    locationId: req.locationId ?? 0,
    cargoId: req.cargoId ?? 0,
    gangId: req.gangId ?? 0,
    requisitionDate: req.date,
    jobDescription: req.job,
    gphaRequestId: req.gphaRequestId,
    shiftType: req.shiftType ?? "Non-Shift",
    shipSide: req.onBoardAllowance ?? false,
    weekend: req.weekends,
    night: req.night,
    normalHours: req.normal,
    overtimeHours: req.overtime,
    approved: req.approved,
    autoNo: req.autoNo,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Daily Requisition — ${req.reqNo}`} breadcrumb="Operations" />
      <RequisitionEditor
        mode="edit"
        initial={initial}
        options={options}
        subStaff={subStaff}
        canSave={canEdit}
      />
    </div>
  );
}
