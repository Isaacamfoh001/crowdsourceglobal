import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { BeautyProfessionalProfileForm } from "../../../../components/vendor-portal/BeautyProfessionalProfileForm";
import { BeautyProfessionalStatusBadge } from "../../../../components/vendor-portal/BeautyProfessionalStatusBadge";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { beautyProfessionalsService } from "../../../../modules/beauty-professionals/service";
import { explorePostsService } from "../../../../modules/explore-posts/service";
import { archiveBeautyProfessionalProfileAction } from "../../../../lib/actions/beauty-professionals";

export const metadata = { title: "Beauty Professional profile — Vendor Portal" };
export const dynamic = "force-dynamic";

/**
 * Vendor Portal — Beauty Professional profile (M22 §16). Extends the
 * existing Vendor Portal rather than a separate application. Portfolio
 * imagery is deliberately not managed here — it's the vendor's own
 * approved Explore posts, managed from /vendor/portal/explore.
 */
export default async function VendorBeautyProfessionalPage() {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional");
  const [profile, categories] = await Promise.all([
    beautyProfessionalsService.getForVendor(vendorId),
    explorePostsService.listCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Beauty Professional profile"
        description="Apply to appear on Beauty Services — CrownSourceGlobal's professional discovery experience — so customers can find you and request a service."
        actions={profile ? <BeautyProfessionalStatusBadge status={profile.status} /> : undefined}
      />

      {profile && profile.status === "APPROVED" ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-espresso-900/65">
            <Sparkles className="size-4 text-champagne-600" strokeWidth={1.75} />
            You&apos;re live — customers can find and request your services.
          </div>
          <div className="flex gap-2">
            <Link href="/vendor/portal/beauty-professional/services">
              <Button variant="outline" size="sm">
                Manage services
              </Button>
            </Link>
            <Link href="/vendor/portal/beauty-professional/requests">
              <Button variant="outline" size="sm">
                Incoming requests
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <BeautyProfessionalProfileForm profile={profile} categories={categories} />
      </Card>

      {profile && profile.status === "APPROVED" ? (
        <form action={archiveBeautyProfessionalProfileAction}>
          <Button type="submit" variant="danger" size="sm">
            Take profile down
          </Button>
        </form>
      ) : null}
    </div>
  );
}
