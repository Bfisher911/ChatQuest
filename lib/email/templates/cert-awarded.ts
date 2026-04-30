import { emailLayout, EMAIL_FONT_MONO, EMAIL_FONT_SANS } from "./_layout";

export interface CertAwardedEmailInput {
  learnerName: string;
  certificateTitle: string;
  programTitle: string;
  organizationName: string;
  verificationCode: string;
  verificationUrl: string;
  pdfUrl?: string;
}

export function renderCertAwardedEmail(input: CertAwardedEmailInput) {
  const subject = `Certificate awarded: ${input.certificateTitle}`;
  const html = emailLayout({
    preheader: `${input.learnerName}, you earned the "${input.certificateTitle}" certificate.`,
    bodyHtml: `
      <p style="font-family:${EMAIL_FONT_MONO}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b6b; margin:0 0 8px;">
        ■ CERTIFICATE AWARDED · ${escape(input.programTitle.toUpperCase())}
      </p>
      <h1 style="font-family:${EMAIL_FONT_SANS}; font-weight:800; font-size:32px; line-height:1.05; letter-spacing:-0.02em; text-transform:uppercase; margin:0 0 16px;">
        ${escape(input.certificateTitle.toUpperCase())}
      </h1>
      <p style="font-family:${EMAIL_FONT_SANS}; font-size:15px; line-height:1.5; margin:0 0 16px;">
        Congratulations, <strong>${escape(input.learnerName)}</strong> — you completed the requirements
        for this certificate, awarded by <strong>${escape(input.organizationName)}</strong>.
      </p>
      <div style="border:2px solid #000; padding:14px; margin:8px 0 16px;">
        <div style="font-family:${EMAIL_FONT_MONO}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b6b;">
          VERIFICATION CODE
        </div>
        <div style="font-family:${EMAIL_FONT_MONO}; font-size:18px; font-weight:700; margin-top:4px;">
          ${escape(input.verificationCode)}
        </div>
        <div style="font-family:${EMAIL_FONT_MONO}; font-size:12px; margin-top:8px;">
          <a href="${input.verificationUrl}" style="color:#000; text-decoration:underline;">${escape(input.verificationUrl)}</a>
        </div>
      </div>
    `,
    ctaText: input.pdfUrl ? "Download PDF" : "View certificate",
    ctaHref: input.pdfUrl ?? input.verificationUrl,
  });

  const text = `Congratulations ${input.learnerName} — you earned the "${input.certificateTitle}" certificate from ${input.organizationName} (${input.programTitle}).\n\nVerification code: ${input.verificationCode}\nVerify: ${input.verificationUrl}${
    input.pdfUrl ? `\nDownload: ${input.pdfUrl}` : ""
  }`;

  return { subject, html, text };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
