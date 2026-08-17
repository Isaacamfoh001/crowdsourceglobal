import { Badge } from "../../ui/Badge";
import type { AttentionSeverity } from "../../../modules/operations/policy";

const CONFIG: Record<AttentionSeverity, { label: string; tone: "danger" | "gold" | "neutral" }> = {
  CRITICAL: { label: "Critical", tone: "danger" },
  NEEDS_ATTENTION: { label: "Needs attention", tone: "gold" },
  NORMAL: { label: "Normal", tone: "neutral" },
};

/** Severity is always communicated by this label text, never by color alone. */
export function SeverityBadge({ severity }: { severity: AttentionSeverity }) {
  const { label, tone } = CONFIG[severity];
  return <Badge tone={tone}>{label}</Badge>;
}
