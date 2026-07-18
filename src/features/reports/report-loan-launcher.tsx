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
import { LOAN_REPORTS, formatDateRange } from "./external-reports";
import { todayInput } from "@/lib/date";

/**
 * External loan report launcher — faithful port of
 * LAMS.Reports/New/LoanReport.razor. Single section (report type + date range);
 * builds a URL against REPORT_APP_URL (`baseUrl`, from the server page) and
 * opens it in a new tab, like the legacy window.open.
 */
export function LoanReportLauncher({ baseUrl }: { baseUrl: string }) {
  const [reportLabel, setReportLabel] = React.useState("");
  const [start, setStart] = React.useState(todayInput());
  const [end, setEnd] = React.useState(todayInput());
  const selected = LOAN_REPORTS.find((r) => r.label === reportLabel);

  function generate() {
    if (!selected) {
      toast.error("Please select a report type.");
      return;
    }
    if (!start || !end) {
      toast.error("Please select a start and end date.");
      return;
    }
    if (start > end) {
      toast.error("Start date cannot be after end date.");
      return;
    }
    if (!baseUrl) {
      toast.error("Report app URL is not configured (REPORT_APP_URL).");
      return;
    }
    const path = selected.build({ dateRange: formatDateRange(start, end), workerType: "", reportBy: "", worker: "" });
    window.open(baseUrl + path, "_blank", "noopener");
  }

  return (
    <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
      <h2 className="text-sm font-semibold">Generate all loan reports</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label>Report Type</Label>
          <Select value={reportLabel} onValueChange={setReportLabel}>
            <SelectTrigger>
              <SelectValue placeholder="Select a report" />
            </SelectTrigger>
            <SelectContent>
              {LOAN_REPORTS.map((r) => (
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
      </div>
      <div className="flex justify-end">
        <Button onClick={generate}>
          <FileBarChart className="size-4" />
          Generate Report
        </Button>
      </div>
    </section>
  );
}
