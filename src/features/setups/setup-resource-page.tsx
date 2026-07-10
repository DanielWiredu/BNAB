import "server-only";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { SETUP_UI, type Option } from "./ui";
import type { ResourceKey } from "./schema";
import {
  listResource,
  listBankBranches,
  listBankOptions,
  listTradeTypes,
  listTradeGroupOptions,
} from "./queries";
import { ResourceManager } from "./resource-manager";

/**
 * Shared async server component that renders any setup resource page:
 * permission guard → data fetch → ResourceManager. Each route file is a thin
 * wrapper that passes its resource key.
 */
export async function SetupResourcePage({
  resourceKey,
  breadcrumb = "Setups",
}: {
  resourceKey: ResourceKey;
  breadcrumb?: string;
}) {
  const ui = SETUP_UI[resourceKey];

  // Reaching the page requires the resource's manage permission; there is no
  // separate view-only permission for setups, so this also gates management.
  await requirePermissionOrRedirect(ui.permission);

  let data: Record<string, unknown>[];
  let fieldOptions: Record<string, Option[]> | undefined;

  if (resourceKey === "bank-branch") {
    data = (await listBankBranches()) as unknown as Record<string, unknown>[];
    fieldOptions = { banks: await listBankOptions() };
  } else if (resourceKey === "trade-type") {
    data = (await listTradeTypes()) as unknown as Record<string, unknown>[];
    fieldOptions = { tradeGroups: await listTradeGroupOptions() };
  } else {
    data = await listResource(resourceKey);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={ui.title} breadcrumb={breadcrumb} />
      <ResourceManager
        ui={ui}
        data={data}
        canManage
        fieldOptions={fieldOptions}
      />
    </div>
  );
}
