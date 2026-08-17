import { Badge } from "../ui/Badge";
import type { ResolutionCaseStatus } from "../../modules/resolutions/types";

const TONE: Record<ResolutionCaseStatus, "brand" | "gold" | "neutral" | "danger"> = {
  OPEN: "gold",
  UNDER_REVIEW: "gold",
  AWAITING_CUSTOMER: "gold",
  AWAITING_VENDOR: "gold",
  RESOLUTION_APPROVED: "brand",
  RESOLUTION_IN_PROGRESS: "brand",
  RESOLVED: "brand",
  REJECTED: "danger",
  CLOSED: "neutral",
};

export function CaseStatusBadge({ status, label }: { status: ResolutionCaseStatus; label: string }) {
  return <Badge tone={TONE[status]}>{label}</Badge>;
}
