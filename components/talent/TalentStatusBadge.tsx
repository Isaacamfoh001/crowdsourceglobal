import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";
import type { TalentApplicationStatus } from "../../modules/talent/types";

const TONE: Record<TalentApplicationStatus, BadgeTone> = {
  NEW: "neutral",
  REVIEWING: "gold",
  SHORTLISTED: "brand",
  REFERRED: "success",
  CLOSED: "neutral",
};

export function TalentStatusBadge({ status, label }: { status: TalentApplicationStatus; label: string }) {
  return <StatusBadge tone={TONE[status]}>{label}</StatusBadge>;
}
