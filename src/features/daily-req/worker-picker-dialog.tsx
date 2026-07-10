"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { findWorkersForAllocation, addSubStaff } from "./actions";
import type { WorkerHit } from "./queries";

/**
 * Search active workers and allocate them to a requisition. Stays open so
 * several workers can be added in one session (mirrors FindWorkerMultiDialog).
 */
export function WorkerPickerDialog({
  open,
  onOpenChange,
  reqNo,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reqNo: string;
  onAdded: () => void;
}) {
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<WorkerHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [addingId, setAddingId] = React.useState<string | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    setResults(await findWorkersForAllocation(term));
    setLoading(false);
  }

  async function add(worker: WorkerHit) {
    setAddingId(worker.workerId);
    const res = await addSubStaff({
      reqNo,
      workerId: worker.workerId,
      tradegroupId: worker.tradegroupId ?? 0,
      tradetypeId: worker.tradetypeId ?? 0,
    });
    setAddingId(null);
    if (res.ok) {
      toast.success(`${worker.workerId} added.`);
      onAdded();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Workers</DialogTitle>
        </DialogHeader>

        <form onSubmit={search} className="flex gap-2">
          <Input
            autoFocus
            placeholder="Search by Worker ID, name or SSF No…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            <Search className="size-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-[var(--border)]">
          {results.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--muted-foreground)]">
              {loading ? "Searching…" : "Search for active workers to allocate."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {results.map((w) => (
                <li key={w.workerId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{w.workerId}</span> — {w.sname} {w.oname}
                    <span className="ml-2 text-[var(--muted-foreground)]">
                      {w.tradegroupName} / {w.tradetypeName}
                    </span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => add(w)} disabled={addingId === w.workerId}>
                    <Plus className="size-4" />
                    {addingId === w.workerId ? "Adding…" : "Add"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
