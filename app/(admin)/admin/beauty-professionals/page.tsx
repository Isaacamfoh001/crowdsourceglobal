import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { beautyProfessionalsService } from "../../../../modules/beauty-professionals/service";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

export const metadata = { title: "Beauty Professionals moderation — Admin" };
export const dynamic = "force-dynamic";

/** Mirrors app/(admin)/admin/explore-posts/page.tsx exactly (M22) — same oldest-first paginated moderation queue shape. */
export default async function AdminBeautyProfessionalsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/beauty-professionals");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: profiles, total, pageSize } = await beautyProfessionalsService.listPendingForAdminPaginated(currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Beauty Professionals awaiting review" description={`${total} profile${total === 1 ? "" : "s"} pending moderation.`} />

      {profiles.length === 0 ? (
        <EmptyState title="Nothing to review" description="No Beauty Professional profiles awaiting review." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/admin/beauty-professionals/${profile.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso-950">{profile.displayName}</p>
                  <p className="text-xs text-espresso-900/50">{profile.vendorName}</p>
                </div>
                <Badge tone="gold" className="w-fit shrink-0">
                  Pending review
                </Badge>
              </Link>
            </li>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/beauty-professionals" />
    </div>
  );
}
