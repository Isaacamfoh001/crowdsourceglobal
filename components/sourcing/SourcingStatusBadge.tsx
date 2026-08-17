const TONE: Record<string, string> = {
  SUBMITTED: "bg-stone-200 text-stone-700",
  UNDER_REVIEW: "bg-gold-100 text-gold-800",
  SOURCING: "bg-gold-100 text-gold-800",
  AWAITING_CUSTOMER: "bg-red-100 text-red-700",
  QUOTED: "bg-brand-100 text-brand-800",
  ACCEPTED: "bg-brand-100 text-brand-800",
  UNABLE_TO_SOURCE: "bg-stone-200 text-stone-600",
  CANCELLED: "bg-stone-200 text-stone-600",
};

/** `label` is always the already-humanized statusLabel from modules/sourcing/service.ts — never a raw enum value. */
export function SourcingStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = TONE[status] ?? "bg-stone-100 text-stone-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>
  );
}
