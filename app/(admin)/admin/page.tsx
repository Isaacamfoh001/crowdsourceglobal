import Link from "next/link";
import { requireAdminSession } from "../../../modules/administration/policy";
import { adminDashboardService } from "../../../modules/admin-dashboard/service";
import { canAccessOperationalModules } from "../../../modules/operations/policy";
import { AttentionList } from "../../../components/admin/dashboard/AttentionList";
import { SummaryCards } from "../../../components/admin/dashboard/SummaryCards";
import { KpiSection } from "../../../components/admin/dashboard/KpiSection";
import { RecentActivity } from "../../../components/admin/dashboard/RecentActivity";
import { PageHeader } from "../../../components/ui/PageHeader";
import type { DateRange } from "../../../modules/admin-dashboard/types";

export const metadata = { title: "Dashboard — Admin" };
export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/admin/operations", label: "Operations" },
  { href: "/admin/vendor-applications", label: "Vendor applications" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/sourcing", label: "Sourcing" },
  { href: "/admin/quotations", label: "Quotations" },
  { href: "/admin/resolutions", label: "Resolutions" },
  { href: "/admin/messages", label: "Messages" },
];

function isDateRange(value: string | undefined): value is DateRange {
  return value === "today" || value === "7d" || value === "30d";
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { admin } = await requireAdminSession("/admin");
  const { range: rawRange } = await searchParams;
  const range: DateRange = isDateRange(rawRange) ? rawRange : "today";
  const operationalAllowed = canAccessOperationalModules(admin.role);

  const data = await adminDashboardService.getDashboardData(admin.role);
  const todayKpis = range === "today" ? data.todayKpis : await adminDashboardService.getTodayKpis(admin.role, range);

  const attentionPreview = data.attentionItems.slice(0, 8);
  const visibleQuickLinks = operationalAllowed
    ? QUICK_LINKS
    : QUICK_LINKS.filter((link) => !["/admin/operations", "/admin/messages", "/admin/resolutions"].includes(link.href));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Operations overview" description="What needs CrownSource attention right now." />

      <SummaryCards summary={data.summary} operationalAllowed={operationalAllowed} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-medium text-espresso-950">Attention required</h2>
          {data.attentionItems.length > 8 ? (
            <Link href="/admin/attention" className="text-sm font-medium text-espresso-800 hover:underline">
              View all ({data.attentionItems.length})
            </Link>
          ) : null}
        </div>
        <div className="mt-3">
          <AttentionList items={attentionPreview} emptyMessage="Nothing requires urgent attention." />
        </div>
      </div>

      <KpiSection today={todayKpis} current={data.currentKpis} range={range} />

      {operationalAllowed ? <RecentActivity entries={data.recentActivity} /> : null}

      <div>
        <h2 className="font-display text-base font-medium text-espresso-950">Quick links</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleQuickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-ivory-400 bg-ivory-50 px-3.5 py-1.5 text-sm font-medium text-espresso-800 hover:bg-ivory-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
