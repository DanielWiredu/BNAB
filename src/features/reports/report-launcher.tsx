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
import type { CatalogEntry } from "./catalog";
import { todayInput } from "@/lib/date";

/**
 * Report launcher — the native replacement for the legacy report-picker pages
 * (Loans/Report.razor, {Daily,Weekly,Monthly}ReqReports.razor). Pick a report +
 * params, then open its print view (`/report/[key]`) in a new tab, exactly as
 * the legacy `window.open(reportUrl, "_blank")` did.
 */
export function ReportLauncher({ entries }: { entries: CatalogEntry[] }) {
  const liveEntries = entries.filter((e) => e.live);
  const [key, setKey] = React.useState<string>(liveEntries[0]?.key ?? "");
  const selected = entries.find((e) => e.key === key);

  // Param state keyed by param name.
  const [values, setValues] = React.useState<Record<string, string>>({});

  // Seed defaults whenever the selected report changes.
  React.useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const p of selected.params) {
      if (p.kind === "date-start" || p.kind === "date-end") next[p.name] = todayInput();
      else if (p.kind === "select") next[p.name] = p.default ?? p.options[0]?.value ?? "";
      else next[p.name] = "";
    }
    setValues(next);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function setVal(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  function generate() {
    if (!selected) return;
    const hasStart = selected.params.some((p) => p.name === "st");
    const hasEnd = selected.params.some((p) => p.name === "ed");
    if (hasStart && hasEnd) {
      if (!values.st || !values.ed) {
        toast.error("Please select a start and end date.");
        return;
      }
      if (values.st > values.ed) {
        toast.error("Start date cannot be after end date.");
        return;
      }
    }
    for (const p of selected.params) {
      if (p.kind === "text" && p.required && !values[p.name]?.trim()) {
        toast.error(`${p.label} is required.`);
        return;
      }
    }
    const qs = new URLSearchParams();
    for (const p of selected.params) {
      if (values[p.name]) qs.set(p.name, values[p.name]);
    }
    window.open(`/report/${selected.key}?${qs.toString()}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label>Report Type</Label>
          <Select value={key} onValueChange={setKey}>
            <SelectTrigger>
              <SelectValue placeholder="Select a report" />
            </SelectTrigger>
            <SelectContent>
              {entries.map((e) => (
                <SelectItem key={e.key} value={e.key} disabled={!e.live}>
                  {e.label}
                  {!e.live ? " (coming soon)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected?.params.map((p) => {
          if (p.kind === "date-start" || p.kind === "date-end") {
            return (
              <div key={p.name} className="space-y-1.5">
                <Label htmlFor={p.name}>{p.label}</Label>
                <Input
                  id={p.name}
                  type="date"
                  value={values[p.name] ?? ""}
                  onChange={(e) => setVal(p.name, e.target.value)}
                />
              </div>
            );
          }
          if (p.kind === "text") {
            return (
              <div key={p.name} className="space-y-1.5">
                <Label htmlFor={p.name}>{p.label}</Label>
                <Input
                  id={p.name}
                  value={values[p.name] ?? ""}
                  placeholder={p.placeholder}
                  onChange={(e) => setVal(p.name, e.target.value)}
                />
              </div>
            );
          }
          return (
            <div key={p.name} className="space-y-1.5">
              <Label>{p.label}</Label>
              <Select value={values[p.name] ?? ""} onValueChange={(v) => setVal(p.name, v)}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${p.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {p.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={generate} disabled={!selected?.live}>
          <FileBarChart className="size-4" />
          Generate Report
        </Button>
      </div>
    </div>
  );
}
