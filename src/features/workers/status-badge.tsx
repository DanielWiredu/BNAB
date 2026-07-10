import { cn } from "@/lib/utils";
import { WORKER_STATUS } from "./schema";

/** Status flag (ACT/INA/…) → badge color classes, light + dark. */
const STATUS_COLORS: Record<string, string> = {
  ACT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  INA: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  NAY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  INC: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  SUS: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  DTH: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

const LABEL_TO_FLAG: Record<string, string> = Object.fromEntries(
  Object.entries(WORKER_STATUS).map(([flag, label]) => [label, flag]),
);

/** Accepts either a flag code (ACT) or its display label (Active). */
function resolveFlag(value: string): string {
  return value in WORKER_STATUS ? value : (LABEL_TO_FLAG[value] ?? value);
}

/** Same palette as STATUS_COLORS but with matching hover shades, for the tag/untag dialog buttons. */
const STATUS_BUTTON_COLORS: Record<string, string> = {
  ACT: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60",
  INA: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800",
  NAY: "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60",
  INC: "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60",
  SUS: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60",
  DTH: "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
};

/** Background/text/hover color classes for a status flag or label — used by the tag/untag dialog buttons. */
export function statusColorClass(value: string): string {
  return STATUS_BUTTON_COLORS[resolveFlag(value)] ?? "bg-muted text-muted-foreground";
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-[var(--muted-foreground)]">—</span>;
  const flag = resolveFlag(value);
  const label = WORKER_STATUS[flag] ?? value;
  const colorClass = STATUS_COLORS[flag] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
      )}
    >
      {label}
    </span>
  );
}
