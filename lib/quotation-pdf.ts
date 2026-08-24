import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { QuotationDetailView } from "../modules/quotation/types";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_BOTTOM = 90;

const INK = rgb(0.11, 0.09, 0.07);
const MUTED = rgb(0.45, 0.43, 0.4);
const ACCENT = rgb(0.09, 0.22, 0.17);
const RULE = rgb(0.85, 0.83, 0.8);

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The standard PDF fonts only support WinAnsiEncoding, which has no glyph
 * for the Cedi sign (₵) lib/format.ts's formatPrice() renders on-screen —
 * pdf-lib throws on encoding it. The ISO code keeps the exact same number
 * lib/format.ts would show, just with a font-safe currency prefix.
 */
function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders the quotation exactly as already shown on the customer detail page
 * (app/(customer)/account/quotes/[id]/page.tsx) — no pricing is recomputed
 * here, per CLAUDE.md §33.3's financial-snapshot rule. Multi-page only as an
 * overflow safeguard; MAX_DRAFT_LINES (20) fits comfortably on one page.
 */
export async function generateQuotationPdf(quote: QuotationDetailView, customerName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`CrownSourceGlobal Quotation ${quote.reference}`);
  pdfDoc.setProducer("CrownSourceGlobal");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const left = MARGIN;
  const right = PAGE_WIDTH - MARGIN;

  const ctx: { page: PDFPage; y: number } = {
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  function ensureSpace(needed: number) {
    if (ctx.y - needed < CONTENT_BOTTOM) {
      ctx.page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      ctx.y = PAGE_HEIGHT - MARGIN;
    }
  }

  function text(value: string, x: number, opts: { font?: PDFFont; size?: number; color?: RGB } = {}) {
    ctx.page.drawText(value, { x, y: ctx.y, size: opts.size ?? 10, font: opts.font ?? font, color: opts.color ?? INK });
  }

  function textRight(value: string, xRight: number, opts: { font?: PDFFont; size?: number; color?: RGB } = {}) {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const width = f.widthOfTextAtSize(value, size);
    ctx.page.drawText(value, { x: xRight - width, y: ctx.y, size, font: f, color: opts.color ?? INK });
  }

  function hr() {
    ctx.page.drawLine({ start: { x: left, y: ctx.y }, end: { x: right, y: ctx.y }, thickness: 1, color: RULE });
  }

  // Header
  text("CrownSourceGlobal", left, { font: bold, size: 18, color: ACCENT });
  textRight("QUOTATION", right, { font: bold, size: 16, color: ACCENT });
  ctx.y -= 26;
  hr();
  ctx.y -= 22;

  // Reference / status
  text("Reference", left, { size: 8, color: MUTED });
  textRight("Status", right, { size: 8, color: MUTED });
  ctx.y -= 13;
  text(quote.reference, left, { font: bold, size: 12 });
  textRight(quote.status, right, { font: bold, size: 12 });
  ctx.y -= 22;

  // Customer
  text("Billed to", left, { size: 8, color: MUTED });
  ctx.y -= 13;
  text(customerName, left, { font: bold, size: 11 });
  ctx.y -= 22;

  // Dates
  text("Issued", left, { size: 8, color: MUTED });
  textRight("Valid until", right, { size: 8, color: MUTED });
  ctx.y -= 13;
  text(formatDate(quote.issuedAt), left, { size: 11 });
  textRight(formatDate(quote.expiresAt), right, { size: 11 });
  ctx.y -= 28;

  // Items
  hr();
  ctx.y -= 16;
  text("Items", left, { font: bold, size: 9, color: MUTED });
  textRight("Amount", right, { font: bold, size: 9, color: MUTED });
  ctx.y -= 16;

  for (const item of quote.items) {
    ensureSpace(item.vendor ? 38 : 26);
    text(`${item.description} × ${item.quantity}`, left, { size: 10 });
    textRight(formatAmount(item.lineTotal, quote.currency), right, { font: bold, size: 10 });
    ctx.y -= 13;
    if (item.vendor) {
      text(item.vendor.companyName, left, { size: 8, color: MUTED });
      ctx.y -= 13;
    }
    ctx.y -= 6;
  }

  // Summary
  ensureSpace(70);
  hr();
  ctx.y -= 18;
  text("Subtotal", left, { size: 10, color: MUTED });
  textRight(formatAmount(quote.subtotal, quote.currency), right, { size: 10 });
  ctx.y -= 16;
  text("Total", left, { font: bold, size: 12 });
  textRight(formatAmount(quote.total, quote.currency), right, { font: bold, size: 12 });

  // Footer
  ensureSpace(50);
  ctx.y -= 30;
  hr();
  ctx.y -= 16;
  text("This quotation is not proof of payment.", left, { size: 8, color: MUTED });
  ctx.y -= 12;
  text("Issued by CrownSourceGlobal.", left, { size: 8, color: MUTED });

  return pdfDoc.save();
}
