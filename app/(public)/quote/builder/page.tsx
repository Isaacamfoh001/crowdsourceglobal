import Link from "next/link";
import { Container } from "../../../../components/ui/Container";
import { Button } from "../../../../components/ui/Button";
import { QuoteDraftLineItem } from "../../../../components/quotation/QuoteDraftLineItem";
import { GenerateQuoteButton } from "../../../../components/quotation/GenerateQuoteButton";
import { formatPrice } from "../../../../lib/format";
import { requireSession } from "../../../../modules/identity/policy";
import { quotationService } from "../../../../modules/quotation/service";
import { getQuoteDraftLines } from "../../../../lib/actions/quotation";

export const metadata = { title: "Build your quote" };
export const dynamic = "force-dynamic";

export default async function QuoteBuilderPage() {
  await requireSession("/quote/builder");

  const draftLines = await getQuoteDraftLines();
  const lines = await quotationService.getDraftPreview(draftLines);

  const eligibleLines = lines.filter((line) => line.stillEligible);
  const subtotal = eligibleLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const currency = lines[0]?.currency ?? "GHS";
  const canGenerate = lines.length > 0 && eligibleLines.length === lines.length;

  return (
    <div className="bg-ivory-50 py-10 sm:py-14">
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-medium text-espresso-950">Build your quote</h1>
        <p className="mt-1.5 text-sm text-espresso-900/50">
          Add bulk quantities from any listing, review pricing, then generate one CrownSourceGlobal
          quotation — even across multiple vendors.
        </p>

        {lines.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-ivory-400 bg-ivory-50 p-10 text-center">
            <p className="text-sm text-espresso-900/50">Your quote is empty.</p>
            <Link href="/shop">
              <Button variant="outline" className="mt-4">
                Browse listings
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-ivory-300 bg-ivory-50 p-6 sm:p-8">
            <div className="divide-y divide-ivory-100">
              {lines.map((line) => (
                <QuoteDraftLineItem key={line.listingId} line={line} />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-ivory-300 pt-4">
              <span className="text-sm font-medium text-espresso-900/65">Estimated subtotal</span>
              <span className="text-lg font-semibold text-espresso-950">
                {formatPrice(subtotal, currency)}
              </span>
            </div>
            <p className="mt-1 text-xs text-espresso-900/35">
              Final pricing is confirmed server-side when your quote is generated.
            </p>

            {!canGenerate ? (
              <p className="mt-4 text-sm text-danger-600">
                Remove unavailable items before generating your quote.
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <GenerateQuoteButton disabled={!canGenerate} />
              <Link href="/shop" className="sm:w-auto">
                <Button variant="outline" size="lg" fullWidth>
                  Add another listing
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
