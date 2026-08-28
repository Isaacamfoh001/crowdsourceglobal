import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";

function describe(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case "PENDING":
      return { label: "Pending review", tone: "gold" };
    case "CHANGES_REQUESTED":
      return { label: "Changes requested", tone: "warning" };
    case "REJECTED":
      return { label: "Rejected", tone: "danger" };
    case "APPROVED":
      return { label: "Live", tone: "success" };
    case "ARCHIVED":
      return { label: "Taken down", tone: "neutral" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

export function BeautyProfessionalStatusBadge({ status }: { status: string }) {
  const { label, tone } = describe(status);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
