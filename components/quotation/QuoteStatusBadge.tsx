const LABELS: Record<string, string> = {
  ISSUED: "Active",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
};

const TONE: Record<string, string> = {
  ISSUED: "bg-brand-100 text-brand-800",
  ACCEPTED: "bg-brand-100 text-brand-800",
  EXPIRED: "bg-stone-200 text-stone-600",
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const tone = TONE[status] ?? "bg-stone-100 text-stone-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}
