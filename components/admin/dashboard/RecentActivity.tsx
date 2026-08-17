import Link from "next/link";
import type { RecentActivityEntry } from "../../../modules/admin-dashboard/types";

export function RecentActivity({ entries }: { entries: RecentActivityEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <h2 className="font-display text-base font-medium text-stone-900">Recent activity</h2>
      <ul className="mt-3 flex flex-col gap-1">
        {entries.map((entry, index) => (
          <li key={`${entry.targetUrl}-${index}`}>
            <Link href={entry.targetUrl} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100">
              <span className="truncate text-stone-700">{entry.label}</span>
              <span className="shrink-0 text-xs text-stone-400">
                {entry.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
