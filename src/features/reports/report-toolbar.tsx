"use client";

import { Printer, FileSpreadsheet, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Print + export toolbar for the report print view. Marked `report-no-print`
 * so it disappears from the printed page / PDF. Export links hit the shared
 * `/api/exports/[key]` route with the same params as the current view.
 */
export function ReportToolbar({
  reportKey,
  query,
}: {
  reportKey: string;
  query: string;
}) {
  const qs = query ? `${query}&` : "?";
  const xlsxHref = `/api/exports/${reportKey}${qs}format=xlsx`;
  const csvHref = `/api/exports/${reportKey}${qs}format=csv`;

  return (
    <div className="report-no-print sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-[var(--border)] bg-[var(--background)] px-6 py-3">
      <Button variant="outline" size="sm" asChild>
        <a href={xlsxHref}>
          <FileSpreadsheet className="size-4" />
          Excel
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={csvHref}>
          <FileText className="size-4" />
          CSV
        </a>
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print
      </Button>
    </div>
  );
}
