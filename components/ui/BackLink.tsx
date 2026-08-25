import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Visible contextual back navigation for detail/sub-pages (M17.1) — a
 * deterministic parent link, not browser-history-dependent, placed at the
 * top of the page so it's visible without scrolling. Generalizes the
 * pattern first used on the vendor listing editor.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-espresso-900/50 hover:text-espresso-950"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}
