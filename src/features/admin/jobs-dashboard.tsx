"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Play, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  triggerReconcile,
  runReconcileNow,
  retryFailedJobs,
  cleanCompletedJobs,
} from "./actions";
import type { JobsSnapshot, QueueStats } from "./queries";

const COUNT_ORDER = ["active", "waiting", "delayed", "completed", "failed", "paused"] as const;

function fmtWhen(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function JobsDashboard({ snapshot }: { snapshot: JobsSnapshot }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(res.error ?? "Operation failed.");
    }
  }

  async function handleDirectReconcile() {
    setBusy(true);
    const res = await runReconcileNow();
    setBusy(false);
    if (res.ok) {
      toast.success(`CLMS reconcile ran — ${res.data.processed} processed.`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Operation failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {snapshot.available && (
          <Button disabled={busy} onClick={() => run(triggerReconcile, "CLMS reconcile enqueued.")}>
            <Play className="size-4" />
            Run CLMS Reconcile Now (queue)
          </Button>
        )}
        <Button disabled={busy} onClick={handleDirectReconcile}>
          <Play className="size-4" />
          Run CLMS Reconcile Now (direct)
        </Button>
        <Button variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {snapshot.available ? (
        snapshot.queues.map((q) => <QueueCard key={q.key} queue={q} busy={busy} run={run} />)
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Queue stats unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
            <p>Could not reach Redis: {snapshot.error}</p>
            <p>
              &quot;Run CLMS Reconcile Now (direct)&quot; above still works without Redis/the
              worker — it runs reconcile inline instead of going through the queue.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QueueCard({
  queue,
  busy,
  run,
}: {
  queue: QueueStats;
  busy: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{queue.name}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => retryFailedJobs(queue.key), "Failed jobs retried.")}
          >
            <RotateCcw className="size-4" />
            Retry Failed
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => cleanCompletedJobs(queue.key), "Completed jobs cleaned.")}
          >
            <Trash2 className="size-4" />
            Clean Completed
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COUNT_ORDER.map((k) => (
            <div key={k} className="rounded-md border border-[var(--border)] p-2 text-center">
              <div className="text-lg font-semibold">{queue.counts[k] ?? 0}</div>
              <div className="text-xs capitalize text-[var(--muted-foreground)]">{k}</div>
            </div>
          ))}
        </div>

        {queue.failed.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Failed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.failed.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.name}</TableCell>
                    <TableCell className="max-w-md truncate text-xs text-[var(--destructive)]" title={j.reason}>
                      {j.reason || "—"}
                    </TableCell>
                    <TableCell>{j.attemptsMade}</TableCell>
                    <TableCell className="text-xs">{fmtWhen(j.failedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
