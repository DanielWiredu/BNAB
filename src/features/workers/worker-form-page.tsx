import "server-only";

import { notFound } from "next/navigation";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { WorkerForm, type WorkerRecord } from "./worker-form";
import {
  findWorker,
  listNationalityOptions,
  listGangOptions,
  listBankOptions,
  listTradeGroupOptions,
  listReportingPointOptions,
  listTradeTypeOptions,
  listBankBranchOptions,
} from "./queries";

/** Loads lookups (+ the worker in edit mode) and renders the registration form. */
export async function WorkerFormPage({ workerId }: { workerId?: string }) {
  const isEdit = !!workerId;
  await requirePermissionOrRedirect(isEdit ? P.Workers.View : P.Workers.Create);

  const [nationalities, gangs, banks, tradeGroups, reportingPoints] = await Promise.all([
    listNationalityOptions(),
    listGangOptions(),
    listBankOptions(),
    listTradeGroupOptions(),
    listReportingPointOptions(),
  ]);

  let worker: WorkerRecord | undefined;
  let initialTradeTypes = [] as Awaited<ReturnType<typeof listTradeTypeOptions>>;
  let initialBankBranches = [] as Awaited<ReturnType<typeof listBankBranchOptions>>;

  if (isEdit) {
    const record = await findWorker(workerId);
    if (!record) notFound();
    worker = record as unknown as WorkerRecord;
    [initialTradeTypes, initialBankBranches] = await Promise.all([
      listTradeTypeOptions(record.tradegroupId ?? 0),
      listBankBranchOptions(record.bankId ?? 0),
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? `Edit Worker — ${worker?.sname ?? ""} ${worker?.oname ?? ""}`.trim() : "Register Worker"}
        breadcrumb="Workers"
      />
      <WorkerForm
        mode={isEdit ? "edit" : "create"}
        worker={worker}
        options={{ nationalities, gangs, banks, tradeGroups, reportingPoints }}
        initialTradeTypes={initialTradeTypes}
        initialBankBranches={initialBankBranches}
      />
    </div>
  );
}
