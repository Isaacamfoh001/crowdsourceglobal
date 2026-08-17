import { NextResponse } from "next/server";
import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { getAdminContext } from "../../../../../modules/administration/policy";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { storageProvider } from "../../../../../lib/storage";

type Params = { id: string };

/**
 * Private attachment download — never a public/static path (CLAUDE.md §53
 * "private-by-default storage, no public directory listing"). Authorization
 * is delegated to sourcingService.getAttachmentForDownload: the request's
 * owning customer, or any authenticated staff member — never another
 * customer, never a Vendor.
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

  const attachment = await sourcingService.getAttachmentForDownload(id, {
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
