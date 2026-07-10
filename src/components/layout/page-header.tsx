import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  breadcrumb,
  children,
}: {
  title: string;
  description?: string;
  /** e.g. "Setups" — shown small above the title. */
  breadcrumb?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {breadcrumb && (
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            {breadcrumb}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
