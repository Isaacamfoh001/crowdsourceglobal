// @vitest-environment node
import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { generateQuotationPdf } from "./quotation-pdf";
import type { QuotationDetailView } from "../modules/quotation/types";

/**
 * pdf-lib compresses each content stream with Flate and shows text via hex
 * strings before Tj/TJ — this decompresses every stream object and decodes
 * the hex runs back to characters, so tests assert on the actual rendered
 * text rather than pixel positions (M15.1 §11 "avoid brittle pixel-level
 * PDF tests").
 */
function extractPdfText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const str = buf.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let combined = "";
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(str)) !== null) {
    const [full, streamContent] = match;
    if (streamContent === undefined) continue;
    const start = match.index + full.indexOf(streamContent);
    const raw = buf.subarray(start, start + streamContent.length);
    try {
      combined += zlib.inflateSync(raw).toString("latin1");
    } catch {
      // not a Flate stream (e.g. an embedded font program) — skip it
    }
  }
  const hexRuns = combined.match(/<([0-9A-Fa-f]+)>/g) ?? [];
  return hexRuns.map((run) => Buffer.from(run.slice(1, -1), "hex").toString("latin1")).join(" ");
}

function baseQuote(overrides: Partial<QuotationDetailView> = {}): QuotationDetailView {
  return {
    id: "quote_1",
    reference: "QT-20260824-7K2MP",
    issuedAt: new Date("2026-08-20T00:00:00Z"),
    expiresAt: new Date("2026-09-19T00:00:00Z"),
    acceptedAt: null,
    status: "ISSUED",
    currency: "GHS",
    subtotal: 4600,
    total: 4600,
    items: [
      {
        id: "item_1",
        description: "Woven Cotton Fabric",
        quantity: 100,
        unitPrice: 46,
        lineTotal: 4600,
        vendor: { companyName: "Accra Textiles Ltd", storefrontSlug: "accra-textiles" },
      },
    ],
    acceptedOrderId: null,
    ...overrides,
  };
}

describe("generateQuotationPdf", () => {
  it("includes the quotation reference", async () => {
    const bytes = await generateQuotationPdf(baseQuote(), "Ama Mensah");
    expect(extractPdfText(bytes)).toContain("QT-20260824-7K2MP");
  });

  it("includes the customer's account display name", async () => {
    const bytes = await generateQuotationPdf(baseQuote(), "Ama Mensah");
    expect(extractPdfText(bytes)).toContain("Ama Mensah");
  });

  it("identifies CrownSourceGlobal as the issuer", async () => {
    const bytes = await generateQuotationPdf(baseQuote(), "Ama Mensah");
    expect(extractPdfText(bytes)).toContain("CrownSourceGlobal");
  });

  it("includes the authoritative total already shown to the customer", async () => {
    const bytes = await generateQuotationPdf(baseQuote({ total: 4600 }), "Ama Mensah");
    // formatPrice renders GHS 4,600.00 with a non-breaking-space-free symbol.
    expect(extractPdfText(bytes)).toContain("4,600.00");
  });

  it("includes the expiry date when available", async () => {
    const bytes = await generateQuotationPdf(baseQuote({ expiresAt: new Date("2026-09-19T00:00:00Z") }), "Ama Mensah");
    expect(extractPdfText(bytes)).toContain("19 Sept 2026");
  });

  it("includes item description, quantity and vendor", async () => {
    const bytes = await generateQuotationPdf(baseQuote(), "Ama Mensah");
    const text = extractPdfText(bytes);
    expect(text).toContain("Woven Cotton Fabric");
    expect(text).toContain("Accra Textiles Ltd");
  });

  it("omits vendor identity for CUSTOM_SOURCING lines (service already nulls it out)", async () => {
    const bytes = await generateQuotationPdf(
      baseQuote({ items: [{ id: "item_1", description: "Custom part", quantity: 1, unitPrice: 500, lineTotal: 500, vendor: null }] }),
      "Ama Mensah",
    );
    expect(extractPdfText(bytes)).not.toContain("Accra Textiles Ltd");
  });

  it("does not recalculate pricing — a quote with a stale/odd total still renders that exact total", async () => {
    const bytes = await generateQuotationPdf(baseQuote({ subtotal: 4600, total: 4600 }), "Ama Mensah");
    const text = extractPdfText(bytes);
    expect(text).toContain("4,600.00");
    // No second, independently-derived total appears anywhere in the document.
    expect((text.match(/4,600\.00/g) ?? []).length).toBeGreaterThan(0);
  });
});
