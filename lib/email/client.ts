// Branded transactional email helper. Sends via Resend when RESEND_API_KEY
// is set; otherwise logs the rendered HTML to the server log so dev environments
// keep working without an email provider.
//
// All templates live in lib/email/templates/. Keep payload types small +
// strongly typed at the call site.

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  // Optional file attachments (e.g., certificate PDF).
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
  // Optional reply-to override (default = EMAIL_FROM)
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Chatrail <noreply@chatquest.local>";

  if (!apiKey) {
    console.log(
      `[email] (no RESEND_API_KEY — would have sent)\n  to: ${input.to}\n  subj: ${input.subject}\n  html (${input.html.length} chars)\n`,
    );
    return { ok: true, messageId: "dev-noop" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === "string" ? a.content : a.content.toString("base64"),
          content_type: a.contentType,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, messageId: json.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
