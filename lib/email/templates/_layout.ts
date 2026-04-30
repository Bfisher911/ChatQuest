// Brutalist email layout. Tables-only, inline styles, max 600px wide.
// Email clients are ~1999-era HTML; flex/grid don't work, web fonts work in
// some clients but degrade fine to the system fallback stack.

export interface LayoutInput {
  preheader: string;
  bodyHtml: string;
  ctaText?: string;
  ctaHref?: string;
  footerNote?: string;
}

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";

export function emailLayout({ preheader, bodyHtml, ctaText, ctaHref, footerNote }: LayoutInput): string {
  const cta =
    ctaText && ctaHref
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="padding-top:24px;">
            <a href="${ctaHref}"
               style="display:inline-block; background:#000; color:#fff; padding:14px 22px; text-decoration:none; font-family:${SANS}; font-weight:800; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; border:2px solid #000;">
              ${escape(ctaText)} →
            </a>
          </td></tr>
        </table>`
      : "";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChatQuest</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:${SANS}; color:#000;">
<span style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">${escape(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#fff; border:3px solid #000; max-width:600px;">
      <tr><td style="padding:24px 28px; border-bottom:2px solid #000;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td>
              <span style="display:inline-block; padding:4px 8px 3px; border:2px solid #000; font-family:${MONO}; font-size:14px; letter-spacing:0.02em; font-weight:700;">CHAT</span><span style="display:inline-block; padding:4px 8px 3px; background:#000; color:#fff; font-family:${MONO}; font-size:14px; font-weight:700;">QUEST</span>
            </td>
            <td align="right" style="font-family:${MONO}; font-size:11px; letter-spacing:0.05em; text-transform:uppercase;">
              CHATBOT-NATIVE LMS
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:32px 28px;">
        ${bodyHtml}
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 28px; border-top:2px solid #000; font-family:${MONO}; font-size:11px; color:#6b6b6b; letter-spacing:0.04em; text-transform:uppercase;">
        ${footerNote ? escape(footerNote) : "© 2026 CHATQUEST · BRUTALIST B&amp;W LMS"}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const EMAIL_FONT_SANS = SANS;
export const EMAIL_FONT_MONO = MONO;
