import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { getAdminContext } from "../../../../../modules/administration/policy";
import { talentService } from "../../../../../modules/talent/service";
import { storageProvider } from "../../../../../lib/storage";

type Params = { id: string };

/**
 * Private work-sample photo download — never a public/static path (CLAUDE.md
 * §34/§53). Unlike sourcing/resolution attachments there is no owning
 * customer to also authorize — the applicant is a guest with no account —
 * so this is admin-only (SUPER_ADMIN/OPS_ADMIN/FINANCE_ADMIN all pass the
 * base admin check here; the narrower [SUPER_ADMIN, OPS_ADMIN] restriction
 * lives on the list/detail *pages* themselves, same as sourcing/resolutions).
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await getAdminContext(session.user.id);
  if (!admin || !["SUPER_ADMIN", "OPS_ADMIN"].includes(admin.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sample = await talentService.getWorkSampleForDownload(id);
  if (!sample) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await storageProvider.readObject(sample.storageKey);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.buffer), {
    headers: {
      "Content-Type": sample.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
