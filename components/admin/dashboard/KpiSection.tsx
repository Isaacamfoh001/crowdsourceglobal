import Link from "next/link";
import type { CurrentKpis, DateRange, TodayKpis } from "../../../modules/admin-dashboard/types";

const RANGE_LABELS: Record<DateRange, string> = { today: "Today", "7d": "7 days", "30d": "30 days" };

export function KpiSection({ today, current, range }: { today: TodayKpis; current: CurrentKpis; range: DateRange }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-medium text-espresso-950">Activity</h2>
          <div className="flex gap-1.5">
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
              <Link
                key={r}
                href={r === "today" ? "/admin" : `/admin?range=${r}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  range === r ? "bg-forest-800 text-white" : "bg-ivory-100 text-espresso-900/65 hover:bg-ivory-300"
                }`}
              >
                {RANGE_LABELS[r]}
              </Link>
            ))}
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiTile label="Orders confirmed" value={today.ordersConfirmed} />
          <KpiTile label="Orders delivered" value={today.ordersDelivered} />
          <KpiTile label="Sourcing requests" value={today.sourcingRequestsSubmitted} />
          <KpiTile label="Vendor applications" value={today.vendorApplicationsReceived} />
          <KpiTile label="Quotes issued" value={today.quotesIssued} />
        </dl>
      </div>

      <div>
        <h2 className="font-display text-base font-medium text-espresso-950">Current</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <KpiTile label="Active vendors" value={current.activeVendors} />
          <KpiTile label="Active listings" value={current.activeListings} />
          <KpiTile label="Fulfilments in progress" value={current.fulfilmentsInProgress} />
        </dl>
      </div>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-3.5">
      <dt className="text-xs text-espresso-900/50">{label}</dt>
      <dd className="mt-1 font-display text-xl font-medium text-espresso-950">{value}</dd>
    </div>
  );
}
