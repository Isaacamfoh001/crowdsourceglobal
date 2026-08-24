import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";

type AlertTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<AlertTone, string> = {
  success: "border-success-200 bg-success-50 text-success-800",
  warning: "border-warning-200 bg-warning-50 text-warning-800",
  danger: "border-danger-200 bg-danger-50 text-danger-800",
  info: "border-info-200 bg-info-50 text-info-800",
  neutral: "border-ivory-300 bg-ivory-100 text-espresso-800",
};

const TONE_ICON: Record<AlertTone, typeof Info> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  info: Info,
  neutral: Info,
};

/**
 * Page-level notice/banner (M14.1) — distinct from FormMessage, which stays
 * scoped to inline form success/error text. Use Alert for a standalone
 * banner: "this account needs verification", "your listing was rejected",
 * an attention summary above a list, etc.
 */
export function Alert({
  tone = "info",
  title,
  className = "",
  children,
}: {
  tone?: AlertTone;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}
