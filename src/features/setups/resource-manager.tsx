"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createRecord, updateRecord, deleteRecord } from "./actions";
import { SETUP_SCHEMAS, type Option, type ResourceUi, type FieldDef } from "./ui";

type Row = Record<string, unknown>;
type FormValues = Record<string, unknown>;

function formatValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function initialValues(fields: FieldDef[], row?: Row): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    const v = row ? row[f.name] : "";
    values[f.name] = v === null || v === undefined ? "" : String(v);
  }
  return values;
}

export function ResourceManager({
  ui,
  data,
  canManage,
  fieldOptions,
}: {
  ui: ResourceUi;
  data: Row[];
  canManage: boolean;
  fieldOptions?: Record<string, Option[]>;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(SETUP_SCHEMAS[ui.key]) as unknown as Resolver<FormValues>,
    defaultValues: initialValues(ui.fields),
  });

  function openCreate() {
    setEditing(null);
    form.reset(initialValues(ui.fields));
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    form.reset(initialValues(ui.fields, row));
    setFormOpen(true);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const res = editing
      ? await updateRecord(ui.key, Number(editing[ui.idField]), values)
      : await createRecord(ui.key, values);

    if (res.ok) {
      toast.success(`${ui.singular} ${editing ? "updated" : "created"}.`);
      setFormOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  });

  async function confirmDelete() {
    if (!deleting) return;
    const res = await deleteRecord(ui.key, Number(deleting[ui.idField]));
    if (res.ok) {
      toast.success(`${ui.singular} deleted.`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = ui.columns.map((c) => ({
      accessorKey: c.key,
      header: c.header,
      cell: ({ getValue }) => formatValue(getValue()),
    }));

    if (canManage) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {ui.rowLink && (
              <Button variant="link" size="sm" asChild>
                <Link
                  href={`${ui.rowLink.basePath}/${String(
                    row.original[ui.rowLink.idField],
                  )}${ui.rowLink.suffix ?? ""}`}
                >
                  {ui.rowLink.label}
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEdit(row.original)}
              aria-label="Edit"
            >
              <Pencil className="size-4" />
            </Button>
            {ui.canDelete !== false && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleting(row.original)}
                aria-label="Delete"
              >
                <Trash2 className="size-4 text-[var(--destructive)]" />
              </Button>
            )}
          </div>
        ),
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui, canManage]);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder={`Search ${ui.title.toLowerCase()}…`}
        toolbar={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add {ui.singular}
            </Button>
          ) : null
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${ui.singular}` : `Add ${ui.singular}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
            {ui.fields.map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                form={form}
                options={
                  field.options ??
                  (field.optionsKey ? fieldOptions?.[field.optionsKey] : undefined)
                }
              />
            ))}

            <DialogFooter className="col-span-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${ui.singular}?`}
        description={`This will permanently remove "${
          deleting ? String(deleting[ui.columns[0].key] ?? "") : ""
        }". This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </>
  );
}

function FieldControl({
  field,
  form,
  options,
}: {
  field: FieldDef;
  form: ReturnType<typeof useForm<FormValues>>;
  options?: Option[];
}) {
  const error = form.formState.errors[field.name]?.message as string | undefined;
  const spanClass = field.colSpan === 2 ? "col-span-2" : "col-span-2 sm:col-span-1";

  return (
    <div className={cn("space-y-1.5", spanClass)}>
      <Label htmlFor={field.name}>{field.label}</Label>

      {field.type === "textarea" ? (
        <textarea
          id={field.name}
          {...form.register(field.name)}
          rows={2}
          className="flex w-full rounded-md border border-[var(--input)] bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        />
      ) : field.type === "select" ? (
        <Controller
          control={form.control}
          name={field.name}
          render={({ field: f }) => (
            <Select
              value={f.value ? String(f.value) : ""}
              onValueChange={f.onChange}
            >
              <SelectTrigger id={field.name}>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(options ?? []).map((opt) => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      ) : (
        <Input
          id={field.name}
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          step={field.type === "number" ? "any" : undefined}
          placeholder={field.placeholder}
          {...form.register(field.name)}
        />
      )}

      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
