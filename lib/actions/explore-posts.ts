"use server";

import { revalidatePath } from "next/cache";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { explorePostsService } from "../../modules/explore-posts/service";

/**
 * Vendor Portal — archive (unpublish) own Explore post (M21 §18/§24). Web
 * capability is deliberately read-only-plus-archive only; post CREATION is
 * mobile-only for M21 V1 — see docs/mobile/MOBILE_V1_PLAN.md's M21 section
 * for the reasoning. Mirrors vendor-listings' toggleActiveAction shape.
 */
export async function archiveExplorePostAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/explore");
  const postId = String(formData.get("postId") ?? "");
  await explorePostsService.archive(vendorId, postId);
  revalidatePath("/vendor/portal/explore");
  revalidatePath(`/vendor/portal/explore/${postId}`);
}
