import { notFound } from "next/navigation";
import { BeautyProfessionalDecisionForms } from "../../../../../components/admin/BeautyProfessionalDecisionForms";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { beautyProfessionalsService } from "../../../../../modules/beauty-professionals/service";
import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { beautyProfessionalImageUrl } from "../../../../../lib/beauty-professional-images";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { BackLink } from "../../../../../components/ui/BackLink";

type Params = { id: string };

export const metadata = { title: "Beauty Professional review — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

/** Mirrors app/(admin)/admin/explore-posts/[id]/page.tsx's shape — no image lightbox needed here (a profile has no moderation-worthy uploaded photos; portfolio content is moderated separately via Explore). */
export default async function AdminBeautyProfessionalDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/beauty-professionals");
  const profile = await beautyProfessionalsService.getForAdmin(id);

  if (!profile) {
    notFound();
  }

  const categories = await explorePostsService.listCategories();
  const specialties = categories.filter((category) => profile.specialtyCategorySlugs.includes(category.slug)).map((category) => category.name).join(", ");
  const reviewable = profile.status === "PENDING";

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/beauty-professionals" label="Back to Beauty Professionals moderation" />

      <PageHeader title={profile.displayName} description={`Applied by ${profile.vendorName}`} />

      {profile.heroImage ? (
        <div className="overflow-hidden rounded-lg border border-ivory-300 bg-ivory-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed photo, not Next's image optimizer */}
          <img src={beautyProfessionalImageUrl(profile.heroImage)} alt={profile.displayName} className="aspect-[16/9] w-full object-cover" />
        </div>
      ) : null}

      <Card>
        <dl className="divide-y divide-ivory-100">
          <Row label="Bio" value={profile.bio ?? ""} />
          <Row label="Specialties" value={specialties} />
          <Row label="Location mode" value={profile.locationMode.replaceAll("_", " ")} />
        </dl>
      </Card>

      {reviewable ? (
        <BeautyProfessionalDecisionForms profileId={profile.id} />
      ) : (
        <Card className="text-sm text-espresso-900/65">This profile is currently {profile.status.toLowerCase().replaceAll("_", " ")}.</Card>
      )}
    </div>
  );
}
