"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Clock, FileText, ClipboardList, ShieldCheck, Users, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OperationalDashboard } from "./queries";
import { COMPANY_NAME } from "@/lib/branding";
import { formatDateShortYear } from "@/lib/date";

const BAR_PALETTE = ["#594AE2", "#FF4081", "#1EC8A0", "#FF9800", "#448AFF", "#9C27B0", "#FF5722", "#607D8B"];
const COST_PALETTE = ["#1EC8A0", "#FF9800"];
const APPROVAL_PALETTE = ["#448AFF", "#1EC8A0", "#FF9800"];

const fmtDate = formatDateShortYear;

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

function Kpi({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  accent: string;
}) {
  return (
    <Card style={{ borderTop: `3px solid ${accent}` }}>
      <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
        <Icon className="size-6" />
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      </CardContent>
    </Card>
  );
}

export function OperationalDashboardView({
  data,
  filters,
}: {
  data: OperationalDashboard;
  filters: { from: string; to: string; unit: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = React.useState(filters.from);
  const [to, setTo] = React.useState(filters.to);
  const [unit, setUnit] = React.useState(filters.unit);
  const [pending, startTransition] = React.useTransition();

  function apply() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (unit.trim()) params.set("unit", unit.trim());
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const { kpi } = data;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-4">
        <div className="space-y-1.5">
          <Label htmlFor="from">From Date</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To Date</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Filter by Unit Description</Label>
          <Input
            id="unit"
            value={unit}
            placeholder="e.g. Container"
            onChange={(e) => setUnit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="w-56"
          />
        </div>
        <Button onClick={apply} disabled={pending}>
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Loading…" : "Apply"}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={ClipboardList} value={kpi.total} label="Total Requests" accent="#594AE2" />
        <Kpi icon={FileText} value={kpi.withCostSheet} label="With Cost Sheet" accent="#1EC8A0" />
        <Kpi icon={Clock} value={kpi.pendingCostSheet} label="Pending Cost Sheet" accent="#FF9800" />
        <Kpi icon={CheckCircle2} value={kpi.gphaApproved} label="GPHA Approved" accent="#448AFF" />
        <Kpi icon={ShieldCheck} value={kpi.gdlcApproved} label={`${COMPANY_NAME} Approved`} accent="#9C27B0" />
        <Kpi icon={Users} value={kpi.workersTotal} label={`Workers (${kpi.workersActive} active)`} accent="#FF4081" />
      </div>

      {/* Row 1: unit bar + cost sheet donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Requests by Unit Description (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.unitBar.length ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.unitBar} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" angle={-30} textAnchor="end" interval={0} height={60} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" width={32} />
                    <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.4 }} contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
                    <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {data.unitBar.map((_, i) => (
                        <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Sheet Status</CardTitle>
          </CardHeader>
          <CardContent>
            {kpi.total ? <DonutChart data={data.costSheet} palette={COST_PALETTE} /> : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: job bar + approval pie */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Requests by Job Type (Top 8)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.jobBar.length ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.jobBar} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" angle={-30} textAnchor="end" interval={0} height={60} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" width={32} />
                    <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.4 }} contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
                    <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {data.jobBar.map((_, i) => (
                        <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Status</CardTitle>
          </CardHeader>
          <CardContent>
            {kpi.total ? <DonutChart data={data.approval} palette={APPROVAL_PALETTE} innerRadius={0} /> : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: unit breakdown + recent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unit Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit Description</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">With CS</TableHead>
                    <TableHead className="text-right">GPHA Appr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unitBreakdown.length ? (
                    data.unitBreakdown.map((r) => (
                      <TableRow key={r.unit}>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.withCostSheet}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.gphaApproved}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-16 text-center text-[var(--muted-foreground)]">No data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Requests (latest 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead className="text-center">CS</TableHead>
                    <TableHead className="text-center">Appr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.length ? (
                    data.recent.map((r) => (
                      <TableRow key={r.labourRequestId}>
                        <TableCell className="font-medium">{r.labourRequestId}</TableCell>
                        <TableCell>{fmtDate(r.requestDate)}</TableCell>
                        <TableCell>{r.unitDescription ?? "—"}</TableCell>
                        <TableCell>{r.jobRequested ?? "—"}</TableCell>
                        <TableCell className="text-center">
                          {r.hasCostSheet ? <CheckCircle2 className="mx-auto size-4 text-[#1EC8A0]" /> : <Clock className="mx-auto size-4 text-[#FF9800]" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.gphaApproved ? <CheckCircle2 className="mx-auto size-4 text-[#448AFF]" /> : <span className="text-[var(--muted-foreground)]">–</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-16 text-center text-[var(--muted-foreground)]">No requests in period</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-[var(--muted-foreground)]">
      No data for selected period
    </div>
  );
}

function DonutChart({
  data,
  palette,
  innerRadius = 55,
}: {
  data: { name: string; value: number }[];
  palette: string[];
  innerRadius?: number;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={90} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
          <Legend verticalAlign="bottom" height={36} fontSize={12} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
