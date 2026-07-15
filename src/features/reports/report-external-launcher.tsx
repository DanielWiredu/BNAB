"use client";

import * as React from "react";
import { FileBarChart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_CONFIG,
  WORKER_TYPE_OPTIONS,
  REPORT_BY_OPTIONS,
  formatDateRange,
  type Period,
} from "./external-reports";
import type { DleCompanyOption } from "./companies";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * External report launcher for Daily/Weekly/Monthly — faithful port of
 * {Daily,Weekly,Monthly}ReqReports.razor. Two sections ("all reports" +
 * "by company"); each builds a URL against REPORT_APP_URL (`baseUrl`, from the
 * server page) and opens it in a new tab, like the legacy window.open.
 */
export function ExternalReportLauncher({
  period,
  baseUrl,
  companies,
}: {
  period: Period;
  baseUrl: string;
  companies: DleCompanyOption[];
}) {
  const config = PERIOD_CONFIG[period];
  const periodLower = period.toLowerCase();

  // ── Section 1: all reports ────────────────────────────────────────────────
  const [reportLabel, setReportLabel] = React.useState("");
  const [start, setStart] = React.useState(today());
  const [end, setEnd] = React.useState(today());
  const [workerType, setWorkerType] = React.useState<string>(WORKER_TYPE_OPTIONS[0].value);
  const [reportBy, setReportBy] = React.useState<string>(REPORT_BY_OPTIONS[0].value);
  const [worker, setWorker] = React.useState("");
  const selected = config.all.find((r) => r.label === reportLabel);

  // ── Section 2: by company ─────────────────────────────────────────────────
  const [companyLabel, setCompanyLabel] = React.useState("");
  const [cStart, setCStart] = React.useState(today());
  const [cEnd, setCEnd] = React.useState(today());
  const [companyIds, setCompanyIds] = React.useState<Set<number>>(new Set());
  const companySelected = config.byCompany.find((r) => r.label === companyLabel);

  function openReport(path: string) {
    if (!baseUrl) {
      toast.error("Report app URL is not configured (REPORT_APP_URL).");
      return;
    }
    window.open(baseUrl + path, "_blank", "noopener");
  }

  function validRange(s: string, e: string): boolean {
    if (!s || !e) {
      toast.error("Please select a start and end date.");
      return false;
    }
    if (s > e) {
      toast.error("Start date cannot be after end date.");
      return false;
    }
    return true;
  }

  function generateAll() {
    if (!selected) {
      toast.error("Please select a report type.");
      return;
    }
    if (!validRange(start, end)) return;
    if (selected.needs === "workerType" && !workerType) {
      toast.error("Worker type is required for this report.");
      return;
    }
    if (selected.needs === "individual" && !worker.trim()) {
      toast.error("Worker ID / SSF No is required for this report.");
      return;
    }
    openReport(selected.build({ dateRange: formatDateRange(start, end), workerType, reportBy, worker: worker.trim() }));
  }

  function generateCompany() {
    if (companyIds.size === 0) {
      toast.error("Please select 1 or more companies.");
      return;
    }
    if (!companySelected) {
      toast.error("Please select a report type.");
      return;
    }
    if (!validRange(cStart, cEnd)) return;
    openReport(companySelected.build({ comps: [...companyIds].join(","), dateRange: formatDateRange(cStart, cEnd) }));
  }

  function toggleCompany(id: number, checked: boolean) {
    setCompanyIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allChecked = companies.length > 0 && companyIds.size === companies.length;
  const someChecked = companyIds.size > 0 && !allChecked;

  function toggleAllCompanies(checked: boolean) {
    setCompanyIds(checked ? new Set(companies.map((c) => c.id)) : new Set());
  }

  return (
    <div className="space-y-6">
      {/* ── All reports ─────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Generate all {periodLower} reports</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label>Report Type</Label>
            <Select value={reportLabel} onValueChange={setReportLabel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a report" />
              </SelectTrigger>
              <SelectContent>
                {config.all.map((r) => (
                  <SelectItem key={r.label} value={r.label}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st">Start Date</Label>
            <Input id="st" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed">End Date</Label>
            <Input id="ed" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>

          {selected?.needs === "workerType" && (
            <div className="space-y-1.5">
              <Label>Worker Type</Label>
              <Select value={workerType} onValueChange={setWorkerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selected?.needs === "individual" && (
            <>
              <div className="space-y-1.5">
                <Label>Search By</Label>
                <Select value={reportBy} onValueChange={setReportBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_BY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="worker">Worker ID / SSF No</Label>
                <Input id="worker" value={worker} placeholder="e.g. D0001" onChange={(e) => setWorker(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={generateAll}>
            <FileBarChart className="size-4" />
            Generate Report
          </Button>
        </div>
      </section>

      {/* ── By company ──────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Generate {periodLower} reports by company</h2>

        <div className="space-y-1.5">
          <Label>Company{companyIds.size > 0 ? ` (${companyIds.size} selected)` : ""}</Label>
          <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-[var(--border)] p-2">
            {companies.length === 0 && <div className="text-sm opacity-70">No companies found.</div>}
            {companies.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 border-b border-[var(--border)] pb-1 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={(e) => toggleAllCompanies(e.target.checked)}
                />
                {allChecked ? "Uncheck all" : "Check all"}
              </label>
            )}
            {companies.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={companyIds.has(c.id)}
                  onChange={(e) => toggleCompany(c.id, e.target.checked)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label>Report Type</Label>
            <Select value={companyLabel} onValueChange={setCompanyLabel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a report" />
              </SelectTrigger>
              <SelectContent>
                {config.byCompany.map((r) => (
                  <SelectItem key={r.label} value={r.label}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cst">Start Date</Label>
            <Input id="cst" type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ced">End Date</Label>
            <Input id="ced" type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={generateCompany}>
            <FileBarChart className="size-4" />
            Generate Report
          </Button>
        </div>
      </section>
    </div>
  );
}
