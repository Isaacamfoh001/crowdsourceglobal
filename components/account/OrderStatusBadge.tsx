const LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Payment pending",
  CONFIRMED: "Confirmed",
  FULFILLING: "Preparing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TONE: Record<string, string> = {
  PENDING_PAYMENT: "bg-gold-100 text-gold-800",
  CONFIRMED: "bg-brand-100 text-brand-800",
  FULFILLING: "bg-brand-100 text-brand-800",
  COMPLETED: "bg-brand-100 text-brand-800",
  CANCELLED: "bg-stone-200 text-stone-600",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const tone = TONE[status] ?? "bg-stone-100 text-stone-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}
