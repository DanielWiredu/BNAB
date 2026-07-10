/**
 * Report engine types — shared by the print view (server component), the
 * Excel/CSV export route handlers, and the client launchers.
 *
 * Native replacement for the legacy Crystal Reports + rptlams.gdlcwave.com
 * deep links (ADR-007 revised). Each legacy `.aspx` report was
 * `SELECT * FROM <view> WHERE <date filter>` rendered by a `.rpt` layout; we
 * model that as a `ReportDef` (data query + presentation columns/grouping) and
 * render it as a print-CSS page, with the same data streamed to Excel/CSV.
 */

/** How a column's raw value is formatted for display / export. */
export type ColumnFormat =
  | "text"
  | "integer"
  | "number" // 2dp
  | "money" // 2dp, thousands separators
  | "date" // dd MMM yyyy
  | "datetime" // dd MMM yyyy HH:mm
  | "yesno";

export interface ReportColumn {
  /** Property name on the data row (matches the SQL/view column, camelCased by the query). */
  key: string;
  /** Column header text. */
  label: string;
  format?: ColumnFormat;
  align?: "left" | "right" | "center";
  /** Sum this column in group subtotals + the grand total footer. */
  total?: boolean;
  /** Excel column width (characters). */
  width?: number;
}

/** A parameter the report needs, collected on the launcher before opening. */
export type ReportParam =
  | { name: "st"; kind: "date-start"; label: string }
  | { name: "ed"; kind: "date-end"; label: string }
  | {
      name: string;
      kind: "select";
      label: string;
      options: { value: string; label: string }[];
      default?: string;
    }
  | {
      name: string;
      kind: "text";
      label: string;
      placeholder?: string;
      required?: boolean;
    };

/** Grouping spec (single level) — mirrors a Crystal group section + subtotal. */
export interface ReportGroup {
  key: string;
  /** Header label prefix, e.g. "Scheme". */
  label: string;
}

export type ReportRow = Record<string, unknown>;

export interface ReportDef {
  /** URL-safe key, e.g. "loan-master". */
  key: string;
  title: string;
  /** Logical family for the launcher grouping + nav. */
  family: "loans" | "daily" | "weekly" | "monthly" | "workers";
  /** Permission required to view/export. */
  permission: string;
  params: ReportParam[];
  columns: ReportColumn[];
  group?: ReportGroup;
  /** Fetch the rows for the given resolved params (server-only). */
  query: (params: Record<string, string>) => Promise<ReportRow[]>;
}

/** Company/branch header shown at the top of every report (was on the .rpt). */
export const REPORT_HEADER = {
  company: "Ghana Dockyard Labour Company",
  branch: "Tema",
} as const;
