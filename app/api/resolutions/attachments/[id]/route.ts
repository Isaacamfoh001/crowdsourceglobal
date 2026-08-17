import { NextResponse } from "next/server";
import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { getAdminContext } from "../../../../../modules/administration/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { storageProvider } from "../../../../../lib/storage";

type Params = { id: string };

/**
 * Private evidence download — never a public/static path. Authorization is
 * delegated to resolutionsService.getAttachmentForDownload: the case's
 * owning customer, or any authenticated staff member — never a Vendor (M9
 * spec: evidence is part of the customer's case content; staff decides what,
 * if anything, to relay to a vendor manually via the vendor conversation).
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [customerProfile, admin] = await Promise.all([
    getCurrentCustomerProfile(session.user.id),
    getAdminContext(session.user.id),
  ]);

  const attachment = await resolutionsService.getAttachmentForDownload(id, {
    customerProfileId: customerProfile?.id,
    isStaff: Boolean(admin),
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await storageProvider.readObject(attachment.storageKey);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
