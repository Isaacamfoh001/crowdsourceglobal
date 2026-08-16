const LABELS: Record<string, string> = {
  PENDING: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  EXCEPTION: "Needs attention",
  CANCELLED: "Cancelled",
};

const TONE: Record<string, string> = {
  PENDING: "bg-gold-100 text-gold-800",
  ACCEPTED: "bg-gold-100 text-gold-800",
  PREPARING: "bg-brand-100 text-brand-800",
  READY: "bg-brand-100 text-brand-800",
  DISPATCHED: "bg-stone-200 text-stone-700",
  DELIVERED: "bg-brand-100 text-brand-800",
  COMPLETED: "bg-brand-100 text-brand-800",
  EXCEPTION: "bg-red-100 text-red-700",
  CANCELLED: "bg-stone-200 text-stone-600",
};

export function FulfilmentStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const tone = TONE[status] ?? "bg-stone-100 text-stone-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>
  );
}
