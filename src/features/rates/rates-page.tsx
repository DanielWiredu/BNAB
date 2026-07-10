import "server-only";

import { notFound } from "next/navigation";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RATE_UI } from "./ui";
import type { RateKey } from "./schema";
import { RatesManager } from "./rates-manager";
import {
  listTradeGroupRates,
  listPayrollSetups,
  latestTradeGroupRate,
  latestPayrollSetup,
  tradeGroupName,
} from "./queries";

/**
 * Shared server component for an effective-dated rate page. For group-scoped
 * resources (trade-group-rate) pass the parent groupId; the page then loads the
 * group's name for the header and scopes the rate list.
 */
export async function RatesPage({
  rateKey,
  groupId = null,
}: {
  rateKey: RateKey;
  groupId?: number | null;
}) {
  const ui = RATE_UI[rateKey];
  await requirePermissionOrRedirect(ui.permission);

  if (ui.groupScoped) {
    if (groupId == null || Number.isNaN(groupId)) notFound();
    const name = await tradeGroupName(groupId);
    if (name == null) notFound();

    const [data, seed] = await Promise.all([
      listTradeGroupRates(groupId),
      latestTradeGroupRate(groupId),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader title={`Rates — ${name}`} breadcrumb="Tools" />
        <Button variant="outline" size="sm" asChild>
          <Link href="/tools/trade-group">
            <ArrowLeft className="size-4" />
            Back to Trade Groups
          </Link>
        </Button>
        <RatesManager
          ui={ui}
          data={data as unknown as Record<string, unknown>[]}
          groupId={groupId}
          seed={seed as unknown as Record<string, unknown> | null}
        />
      </div>
    );
  }

  const [data, seed] = await Promise.all([listPayrollSetups(), latestPayrollSetup()]);

  return (
    <div className="space-y-6">
      <PageHeader title={ui.title} breadcrumb="Tools" />
      <RatesManager
        ui={ui}
        data={data as unknown as Record<string, unknown>[]}
        groupId={null}
        seed={seed as unknown as Record<string, unknown> | null}
      />
    </div>
  );
}
