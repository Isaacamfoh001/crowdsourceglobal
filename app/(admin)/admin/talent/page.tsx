import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { talentService, TALENT_SKILL_LABELS, TALENT_STATUS_LABELS, TALENT_EXPERIENCE_LABELS, TALENT_OPPORTUNITY_LABELS } from "../../../../modules/talent/service";
import { TalentStatusBadge } from "../../../../components/talent/TalentStatusBadge";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SearchForm } from "../../../../components/catalogue/SearchForm";
import { Pagination } from "../../../../components/shared/Pagination";
import { parsePage } from "../../../../lib/pagination";
import type { TalentApplicationStatus, TalentSkill } from "../../../../modules/talent/types";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

export const metadata = { title: "Beauty Talent — Admin" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: TalentApplicationStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "NEW", label: "New" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "REFERRED", label: "Referred" },
  { value: "CLOSED", label: "Closed" },
];

export default async function AdminTalentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; skill?: string; q?: string; page?: string }>;
}) {
  await requireAdminSession("/admin/talent", [...ADMIN_OPS_ROLES]);
  const { status, skill, q, page } = await searchParams;
  const activeStatus = STATUS_FILTERS.find((f) => f.value === status)?.value;
  const activeSkill = skill && skill in TALENT_SKILL_LABELS ? (skill as TalentSkill) : undefined;
  const currentPage = parsePage(page);

  const { rows: applications, total, pageSize } = await talentService.listForAdminPaginated(
    { status: activeStatus, skill: activeSkill, search: q },
    currentPage,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Beauty Talent" description={`${total} application${total === 1 ? "" : "s"}.`} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={{
                pathname: "/admin/talent",
                query: { ...(filter.value ? { status: filter.value } : {}), ...(activeSkill ? { skill: activeSkill } : {}), ...(q ? { q } : {}) },
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                activeStatus === filter.value ? "bg-espresso-800 text-white" : "bg-ivory-50 text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-100"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <SearchForm action="/admin/talent" defaultValue={q} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={{ pathname: "/admin/talent", query: { ...(activeStatus ? { status: activeStatus } : {}), ...(q ? { q } : {}) } }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !activeSkill ? "bg-champagne-200 text-espresso-900" : "bg-ivory-100 text-espresso-900/55 hover:bg-ivory-200"
          }`}
        >
          All skills
        </Link>
        {(Object.entries(TALENT_SKILL_LABELS) as [TalentSkill, string][]).map(([value, label]) => (
          <Link
            key={value}
            href={{ pathname: "/admin/talent", query: { skill: value, ...(activeStatus ? { status: activeStatus } : {}), ...(q ? { q } : {}) } }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeSkill === value ? "bg-champagne-200 text-espresso-900" : "bg-ivory-100 text-espresso-900/55 hover:bg-ivory-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title={q || activeStatus || activeSkill ? "No applications match these filters." : "No talent applications yet."}
          description={q || activeStatus || activeSkill ? "Try a different filter or search term." : "New Beauty Talent applications will show up here."}
        />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {applications.map((application) => (
            <Link
              key={application.id}
              href={`/admin/talent/${application.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-espresso-950">{application.fullName}</p>
                <p className="mt-0.5 truncate text-xs text-espresso-900/50">
                  {application.city}
                  {application.region ? `, ${application.region}` : ""} ·{" "}
                  {application.skills.slice(0, 2).map((s) => TALENT_SKILL_LABELS[s]).join(", ")}
                  {application.skills.length > 2 ? ` +${application.skills.length - 2}` : ""} ·{" "}
                  {TALENT_EXPERIENCE_LABELS[application.experienceLevel]} · {application.workSampleCount} photo
                  {application.workSampleCount === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 truncate text-xs text-espresso-900/35">
                  {application.opportunityTypes.map((o) => TALENT_OPPORTUNITY_LABELS[o]).join(", ")} ·{" "}
                  {application.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="shrink-0">
                <TalentStatusBadge status={application.status} label={TALENT_STATUS_LABELS[application.status]} />
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Pagination
        currentPage={currentPage}
        total={total}
        pageSize={pageSize}
        basePath="/admin/talent"
        extraParams={{ status: activeStatus, skill: activeSkill, q }}
      />
    </div>
  );
}
