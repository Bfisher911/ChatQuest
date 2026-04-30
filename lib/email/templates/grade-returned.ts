import { emailLayout, EMAIL_FONT_MONO, EMAIL_FONT_SANS } from "./_layout";

export interface GradeReturnedEmailInput {
  learnerName: string;
  programTitle: string;
  nodeTitle: string;
  score: number | null;
  maxScore: number | null;
  status: "graded" | "needs_revision" | "excused";
  comment: string | null;
  programUrl: string;
}

export function renderGradeReturnedEmail(input: GradeReturnedEmailInput) {
  const subject =
    input.status === "needs_revision"
      ? `Revision requested: ${input.nodeTitle}`
      : `Graded: ${input.nodeTitle}`;

  const headline =
    input.status === "needs_revision"
      ? "REVISION REQUESTED."
      : input.status === "excused"
      ? "MARKED EXCUSED."
      : "YOUR GRADE IS IN.";

  const scoreLine =
    input.score != null && input.maxScore != null
      ? `<div style="font-family:${EMAIL_FONT_SANS}; font-weight:800; font-size:48px; line-height:1; margin:8px 0 16px;">
          ${input.score}<span style="font-family:${EMAIL_FONT_MONO}; font-size:18px; opacity:0.5;"> / ${input.maxScore}</span>
        </div>`
      : "";

  const commentBlock = input.comment
    ? `<div style="border:2px solid #000; padding:12px; font-family:${EMAIL_FONT_MONO}; font-size:13px; line-height:1.5; margin:8px 0 0;">
        <strong style="font-family:${EMAIL_FONT_SANS}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; display:block; margin-bottom:6px;">■ INSTRUCTOR COMMENT</strong>
        ${escape(input.comment)}
      </div>`
    : "";

  const html = emailLayout({
    preheader: `${input.learnerName}, your work on "${input.nodeTitle}" has been ${input.status === "needs_revision" ? "returned for revision" : "graded"}.`,
    bodyHtml: `
      <p style="font-family:${EMAIL_FONT_MONO}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6b6b; margin:0 0 8px;">
        ■ ${escape(input.programTitle.toUpperCase())} · ${escape(input.nodeTitle.toUpperCase())}
      </p>
      <h1 style="font-family:${EMAIL_FONT_SANS}; font-weight:800; font-size:32px; line-height:1.05; letter-spacing:-0.02em; text-transform:uppercase; margin:0 0 16px;">
        ${headline}
      </h1>
      ${scoreLine}
      ${commentBlock}
    `,
    ctaText: input.status === "needs_revision" ? "Open and revise" : "View grade",
    ctaHref: input.programUrl,
  });

  const text = `Your work on "${input.nodeTitle}" in ${input.programTitle} has been ${
    input.status === "needs_revision" ? "returned for revision" : "graded"
  }.${input.score != null ? ` Score: ${input.score}/${input.maxScore}.` : ""}${
    input.comment ? `\n\nInstructor comment: ${input.comment}` : ""
  }\n\nOpen: ${input.programUrl}`;

  return { subject, html, text };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
