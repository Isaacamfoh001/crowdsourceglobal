import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";

const TONE: Record<string, BadgeTone> = {
  SUBMITTED: "neutral",
  UNDER_REVIEW: "gold",
  SOURCING: "gold",
  AWAITING_CUSTOMER: "warning",
  QUOTED: "brand",
  ACCEPTED: "success",
  UNABLE_TO_SOURCE: "neutral",
  CANCELLED: "neutral",
};

/** `label` is always the already-humanized statusLabel from modules/sourcing/service.ts — never a raw enum value. */
export function SourcingStatusBadge({ status, label }: { status: string; label: string }) {
  return <StatusBadge tone={TONE[status] ?? "neutral"}>{label}</StatusBadge>;
}
