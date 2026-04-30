import * as React from "react";
import { Eyebrow } from "@/components/brutalist";

export const metadata = {
  title: "Acceptable Use Policy — ChatQuest",
  description: "What you can and can't do on ChatQuest.",
};
export const revalidate = 86400;

const LAST_UPDATED = "2026-04-29";

export default function AupPage() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>LEGAL</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        ACCEPTABLE USE POLICY.
      </h1>
      <p className="cq-mono" style={{ color: "var(--muted)", marginBottom: 24 }}>
        LAST UPDATED · {LAST_UPDATED}
      </p>

      <p style={{ marginBottom: 24, fontSize: 16, lineHeight: 1.55 }}>
        ChatQuest is for serious chatbot-based learning. Don't use it for any of
        the following:
      </p>

      <ul style={{ fontSize: 16, lineHeight: 1.7, paddingLeft: 24 }}>
        <li>Illegal activity in the jurisdictions where you and your learners are.</li>
        <li>Generating CSAM, harassment, doxxing material, malware, phishing copy, election disinfo, or anything that violates the underlying LLM provider's terms.</li>
        <li>Trying to extract other tenants' data, evade rate limits, scrape the platform, or reverse-engineer security controls.</li>
        <li>Using ChatQuest as a generic LLM proxy unrelated to learning content (we'll close these accounts and forfeit any deposit).</li>
        <li>Impersonating real people in a way that misleads learners.</li>
        <li>Knowingly uploading copyrighted materials you don't have rights to.</li>
        <li>Running benchmark / load tests without prior written approval.</li>
      </ul>

      <p style={{ fontSize: 16, lineHeight: 1.55, marginTop: 24 }}>
        Reports: <a href="mailto:abuse@chatquest.app" style={{ textDecoration: "underline" }}>abuse@chatquest.app</a>.
        Security: <a href="mailto:security@chatquest.app" style={{ textDecoration: "underline" }}>security@chatquest.app</a>.
      </p>
    </article>
  );
}
