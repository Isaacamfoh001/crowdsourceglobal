import { NextResponse } from "next/server";
import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { quotationService } from "../../../../../modules/quotation/service";
import { generateQuotationPdf } from "../../../../../lib/quotation-pdf";

type Params = { id: string };

/**
 * Customer-side quotation PDF download (M15.1). Authorization is identical
 * to the customer quote detail page: getDetailForCustomer only ever queries
 * by (id, customerProfileId) together, so a quote another customer owns —
 * or one that doesn't exist — simply resolves to null here, same as that
 * page's notFound(). No public/admin path added by this route.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = await quotationService.getDetailForCustomer(id, customerProfile.id);
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const pdfBytes = await generateQuotationPdf(quote, customerProfile.displayName);
    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CrownSourceGlobal-Quotation-${quote.reference}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Quotation PDF generation failed:", error);
    return NextResponse.json({ error: "Could not generate the quotation PDF. Please try again." }, { status: 500 });
  }
}
