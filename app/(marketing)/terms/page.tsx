import * as React from "react";
import { Eyebrow } from "@/components/brutalist";

export const metadata = {
  title: "Terms of Service — ChatQuest",
  description: "ChatQuest terms of service.",
};
export const revalidate = 86400;

const LAST_UPDATED = "2026-04-29";

export default function TermsPage() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>LEGAL</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        TERMS OF SERVICE.
      </h1>
      <p className="cq-mono" style={{ color: "var(--muted)", marginBottom: 24 }}>
        LAST UPDATED · {LAST_UPDATED}
      </p>

      <p style={{ marginBottom: 16, fontStyle: "italic", color: "var(--muted)" }}>
        TODO — replace this scaffold with the version you and counsel sign off
        on. The shape below is a starting point; specific clauses (governing
        law, indemnification, data residency, AI-output ownership) need to be
        completed before going public.
      </p>

      <Section title="1. Who's who">
        ChatQuest is operated by [LEGAL ENTITY]. By using the platform you
        agree to these terms. If you sign up on behalf of an organization,
        you're agreeing on its behalf and confirming you have authority to
        do so.
      </Section>

      <Section title="2. Accounts">
        You must provide accurate sign-up info. You're responsible for keeping
        your password safe and for activity under your account. You must be
        at least the age of digital consent in your jurisdiction.
      </Section>

      <Section title="3. Acceptable use">
        See <a href="/aup" style={{ textDecoration: "underline" }}>/aup</a>.
        In short: don't break laws, don't abuse the AI, don't try to extract
        other tenants' data, and don't ship malware through us.
      </Section>

      <Section title="4. AI outputs">
        ChatQuest passes your inputs to third-party LLM providers (Anthropic,
        OpenAI, Google) under contracts that prohibit provider training on
        your content. Outputs are generated probabilistically and may be
        incorrect; you're responsible for verifying anything you rely on.
      </Section>

      <Section title="5. Your content">
        You keep ownership of everything you upload, write, or generate. You
        grant ChatQuest a license to host, process, and display it as needed
        to operate the service. Instructors retain rights over course
        materials they author; learners retain rights over their submissions.
      </Section>

      <Section title="6. Billing">
        Paid plans are billed via Stripe. Subscriptions auto-renew until
        canceled. You can cancel any time via the Customer Portal; your access
        continues through the end of the paid period.
      </Section>

      <Section title="7. Termination">
        We can suspend or terminate accounts that violate these terms. You
        can delete your account at /account/delete-account; your data is
        purged within 30 days (audit logs may be retained longer for legal
        compliance).
      </Section>

      <Section title="8. Disclaimer + limitation of liability">
        Service is provided "as is." [INSERT JURISDICTION-SPECIFIC LIMITATION
        CLAUSES HERE — counsel to fill.]
      </Section>

      <Section title="9. Changes">
        We may update these terms; we'll change the &quot;last updated&quot; date
        and email you for material changes.
      </Section>

      <Section title="10. Contact">
        legal@chatquest.app
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </h2>
      <div style={{ fontSize: 16, lineHeight: 1.55 }}>{children}</div>
    </section>
  );
}
