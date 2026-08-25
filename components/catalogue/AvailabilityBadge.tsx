const LABELS: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  MADE_TO_ORDER: "Made to order",
};

const TONE: Record<string, string> = {
  IN_STOCK: "bg-success-100 text-success-800",
  LOW_STOCK: "bg-champagne-200/70 text-champagne-700",
  OUT_OF_STOCK: "bg-espresso-950/10 text-espresso-900/70",
  MADE_TO_ORDER: "bg-ivory-300 text-espresso-900/70",
};

export function AvailabilityBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const tone = TONE[status] ?? "bg-ivory-200 text-espresso-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}
