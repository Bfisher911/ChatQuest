import { emailLayout, EMAIL_FONT_MONO, EMAIL_FONT_SANS } from "./_layout";

export interface InviteEmailInput {
  inviteUrl: string;
  inviterName: string;
  organizationName: string;
  programTitle?: string | null;
  role: string;
}

export function renderInviteEmail(input: InviteEmailInput): { subject: string; html: string; text: string } {
  const subject = input.programTitle
    ? `Invite to ${input.programTitle} on ChatQuest`
    : `Invite to ${input.organizationName} on ChatQuest`;

  const html = emailLayout({
    preheader: `${input.inviterName} invited you to join ${input.organizationName} on ChatQuest.`,
    bodyHtml: `
      <p style="font-family:${EMAIL_FONT_MONO}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b6b; margin:0 0 8px;">
        ■ INVITATION · ${input.role.toUpperCase()}
      </p>
      <h1 style="font-family:${EMAIL_FONT_SANS}; font-weight:800; font-size:32px; line-height:1.05; letter-spacing:-0.02em; text-transform:uppercase; margin:0 0 16px;">
        YOU&rsquo;RE INVITED.
      </h1>
      <p style="font-family:${EMAIL_FONT_SANS}; font-size:15px; line-height:1.5; margin:0 0 12px;">
        <strong>${escape(input.inviterName)}</strong> invited you to join
        <strong>${escape(input.organizationName)}</strong> on ChatQuest${
          input.programTitle ? ` and the program <strong>${escape(input.programTitle)}</strong>` : ""
        }.
      </p>
      <p style="font-family:${EMAIL_FONT_SANS}; font-size:15px; line-height:1.5; margin:0;">
        Click the button below to accept and create your account. The link
        expires in 14 days.
      </p>
    `,
    ctaText: "Accept invite",
    ctaHref: input.inviteUrl,
    footerNote: `If you weren’t expecting this invite, ignore the email.`,
  });

  const text = `${input.inviterName} invited you to join ${input.organizationName} on ChatQuest${
    input.programTitle ? ` and the program "${input.programTitle}"` : ""
  }.\n\nAccept: ${input.inviteUrl}\n\nThe link expires in 14 days.`;

  return { subject, html, text };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
