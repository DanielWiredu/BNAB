"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SelectableWorker {
  workerId: string;
  sname: string | null;
  oname: string | null;
  tradegroupId: number | null;
  tradetypeId: number | null;
  tradegroupName: string | null;
  tradetypeName: string | null;
}

/**
 * Generic single-select worker search dialog. The caller supplies a `search`
 * server action (so the permission scope is decided per feature) and receives
 * the chosen worker via `onSelect`.
 */
export function WorkerSelectDialog({
  open,
  onOpenChange,
  search,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: (term: string) => Promise<SelectableWorker[]>;
  onSelect: (worker: SelectableWorker) => void;
}) {
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<SelectableWorker[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    setResults(await search(term));
    setLoading(false);
  }

  function pick(w: SelectableWorker) {
    onSelect(w);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Worker</DialogTitle>
        </DialogHeader>

        <form onSubmit={run} className="flex gap-2">
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
              {loading ? "Searching…" : "Search for an active worker."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {results.map((w) => (
                <li key={w.workerId}>
                  <button
                    type="button"
                    onClick={() => pick(w)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
                  >
                    <span>
                      <span className="font-medium">{w.workerId}</span> — {w.sname} {w.oname}
                    </span>
                    <span className="text-[var(--muted-foreground)]">
                      {w.tradegroupName} / {w.tradetypeName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
