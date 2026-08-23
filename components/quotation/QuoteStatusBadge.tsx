import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";

const LABELS: Record<string, string> = {
  ISSUED: "Active",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
};

const TONE: Record<string, BadgeTone> = {
  ISSUED: "brand",
  ACCEPTED: "success",
  EXPIRED: "neutral",
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  return <StatusBadge tone={TONE[status] ?? "neutral"}>{label}</StatusBadge>;
}
