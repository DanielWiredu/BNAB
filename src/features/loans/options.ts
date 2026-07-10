import type { ComboOption } from "@/components/ui/combobox";

/** Map loan-scheme rows to ComboBox options (value = id, label = scheme name). */
export function schemeOptions(rows: Record<string, unknown>[]): ComboOption[] {
  return rows.map((r) => ({ value: Number(r.id), label: String(r.loanScheme ?? "") }));
}
