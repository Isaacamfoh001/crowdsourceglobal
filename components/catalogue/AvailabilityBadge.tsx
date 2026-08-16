const LABELS: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  MADE_TO_ORDER: "Made to order",
};

const TONE: Record<string, string> = {
  IN_STOCK: "bg-brand-100 text-brand-800",
  LOW_STOCK: "bg-gold-100 text-gold-800",
  OUT_OF_STOCK: "bg-stone-200 text-stone-600",
  MADE_TO_ORDER: "bg-stone-100 text-stone-700",
};

export function AvailabilityBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const tone = TONE[status] ?? "bg-stone-100 text-stone-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}
