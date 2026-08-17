import { env } from "./env";

const BRAND_GREEN = "#22603c";
const TEXT = "#1c1917";
const MUTED = "#78716c";
const BORDER = "#e7e5e4";

export type TemplateContent = {
  title: string;
  /** One short paragraph — what happened. */
  intro: string;
  /** Additional short paragraphs — what it means / what to do next. */
  bodyLines?: string[];
  ctaLabel?: string;
  /** App-relative path — the renderer builds the absolute URL from NEXT_PUBLIC_APP_URL. */
  ctaPath?: string;
  /** For the rare case the URL is already absolute and provider-generated (e.g. Better Auth's verification/reset links) — takes precedence over ctaPath. */
  ctaAbsoluteUrl?: string;
};

/**
 * The one shared brand shell every transactional email renders through —
 * header, typography, spacing, footer, CTA button — so no email is ad-hoc
 * string concatenation (CLAUDE.md/M7 brief). Inline styles throughout:
 * email clients don't load external/Tailwind CSS. Always produces both an
 * HTML and a plain-text version — no email depends on images for essential
 * content (there are no images at all).
 */
export function renderEmail(content: TemplateContent): { html: string; text: string } {
  const ctaUrl = content.ctaAbsoluteUrl ?? (content.ctaPath ? `${env.NEXT_PUBLIC_APP_URL}${content.ctaPath}` : null);
  const paragraphs = [content.intro, ...(content.bodyLines ?? [])];

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
            <tr>
              <td style="padding:28px 32px 20px 32px;border-bottom:1px solid ${BORDER};">
                <span style="font-size:15px;font-weight:700;color:${BRAND_GREEN};letter-spacing:0.01em;">CrownSourceGlobal</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.35;color:${TEXT};font-weight:600;">${escapeHtml(content.title)}</h1>
                ${paragraphs.map((p) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${TEXT};">${escapeHtml(p)}</p>`).join("")}
                ${
                  ctaUrl && content.ctaLabel
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px 0;">
                        <tr><td style="border-radius:10px;background-color:${BRAND_GREEN};">
                          <a href="${ctaUrl}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(content.ctaLabel)}</a>
                        </td></tr>
                      </table>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">CrownSourceGlobal — a managed marketplace connecting buyers with approved vendors.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "CrownSourceGlobal",
    "",
    content.title,
    "",
    ...paragraphs,
    ...(ctaUrl && content.ctaLabel ? ["", `${content.ctaLabel}: ${ctaUrl}`] : []),
  ].join("\n");

  return { html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
