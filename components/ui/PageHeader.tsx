import type { ReactNode } from "react";

/**
 * Shared page-level heading (M14.1) for account/vendor-portal/admin screens
 * — a title, optional description, and an optional right-aligned action
 * slot that wraps to its own row on narrow screens instead of squeezing
 * the title. Long titles wrap and never force horizontal scrolling.
 */
export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-medium break-words text-espresso-950 sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-espresso-900/65">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
