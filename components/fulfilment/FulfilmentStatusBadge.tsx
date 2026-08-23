import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";

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

const TONE: Record<string, BadgeTone> = {
  PENDING: "gold",
  ACCEPTED: "gold",
  PREPARING: "brand",
  READY: "brand",
  DISPATCHED: "brand",
  DELIVERED: "success",
  COMPLETED: "success",
  EXCEPTION: "danger",
  CANCELLED: "neutral",
};

export function FulfilmentStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  return <StatusBadge tone={TONE[status] ?? "neutral"}>{label}</StatusBadge>;
}
