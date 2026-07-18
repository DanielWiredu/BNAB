"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createRate, updateRate } from "./actions";
import { RATE_SCHEMAS, type RateUi, type RateField } from "./ui";
import { toDateInput, formatDate } from "@/lib/date";

type Row = Record<string, unknown>;
type FormValues = Record<string, unknown>;


function num(v: unknown): string {
  return v === null || v === undefined || v === "" ? "0" : String(v);
}

function buildDefaults(ui: RateUi, row?: Row): FormValues {
  const values: FormValues = {};
  for (const f of ui.fields) values[f.name] = row ? num(row[f.name]) : "0";
  values.effectiveDate = row ? toDateInput(row.effectiveDate) : toDateInput(new Date());
  values.endDate = row ? toDateInput(row.endDate) : "";
  return values;
}

export function RatesManager({
  ui,
  data,
  groupId,
  seed,
}: {
  ui: RateUi;
  data: Row[];
  groupId: number | null;
  /** Latest existing row, used to pre-fill a new rate (like the legacy dialog). */
  seed?: Row | null;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(RATE_SCHEMAS[ui.key]) as unknown as Resolver<FormValues>,
    defaultValues: buildDefaults(ui),
  });

  function openCreate() {
    setEditing(null);
    // Pre-fill numeric fields from the latest rate, but reset the effective date.
    form.reset({ ...buildDefaults(ui, seed ?? undefined), effectiveDate: toDateInput(new Date()), endDate: "" });
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    form.reset(buildDefaults(ui, row));
    setFormOpen(true);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const res = editing
      ? await updateRate(ui.key, Number(editing.id), groupId, values)
      : await createRate(ui.key, groupId, values);

    if (res.ok) {
      toast.success(`${ui.singular} ${editing ? "updated" : "saved"}.`);
      setFormOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  });

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "effectiveDate",
        header: "Effective Date",
        cell: ({ getValue }) => formatDate(getValue()),
      },
      {
        accessorKey: "endDate",
        header: "End Date",
        cell: ({ getValue }) => formatDate(getValue()),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEdit(row.original)}
              aria-label="Edit"
            >
              <Pencil className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ui],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by date…"
        toolbar={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add {ui.singular}
          </Button>
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${ui.singular}` : `Add ${ui.singular}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {ui.fields.map((field) => (
              <NumberField key={field.name} field={field} form={form} />
            ))}

            <DateField name="effectiveDate" label="Effective Date" form={form} />
            {editing && <DateField name="endDate" label="End Date" form={form} />}

            <DialogFooter className="col-span-2 mt-2 sm:col-span-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : editing ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NumberField({
  field,
  form,
}: {
  field: RateField;
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name}>
        {field.label}
        {field.unit === "%" && <span className="text-[var(--muted-foreground)]"> (%)</span>}
      </Label>
      <Input
        id={field.name}
        type="number"
        step="any"
        {...form.register(field.name)}
      />
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

function DateField({
  name,
  label,
  form,
}: {
  name: string;
  label: string;
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type="date" {...form.register(name)} />
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
