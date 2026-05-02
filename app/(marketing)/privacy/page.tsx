import * as React from "react";
import { Eyebrow } from "@/components/brutalist";

export const metadata = {
  title: "Privacy Policy — Chatrail",
  description: "How Chatrail collects, uses, and protects your data.",
};
export const revalidate = 86400;

const LAST_UPDATED = "2026-04-29";

export default function PrivacyPage() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>LEGAL</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        PRIVACY POLICY.
      </h1>
      <p className="cq-mono" style={{ color: "var(--muted)", marginBottom: 24 }}>
        LAST UPDATED · {LAST_UPDATED}
      </p>

      <p style={{ marginBottom: 16, fontStyle: "italic", color: "var(--muted)" }}>
        TODO — counsel review before launch. The summary below describes
        actual data flows in the codebase and is accurate as of the last
        updated date; the legal framing is a placeholder.
      </p>

      <Section title="What we collect">
        <ul>
          <li><strong>Account info</strong>: email, name, hashed password, role.</li>
          <li><strong>Course content</strong>: programs, nodes, KB files, rubrics, certificates.</li>
          <li><strong>Conversations</strong>: every learner-bot turn, retained for grading.</li>
          <li><strong>Usage logs</strong>: token counts per call, for billing + cost control.</li>
          <li><strong>Audit logs</strong>: sensitive admin actions for compliance.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        Operate the platform; bill; support; improve via aggregate analytics.
        We never sell personal data.
      </Section>

      <Section title="Subprocessors">
        <ul>
          <li>Supabase (Postgres + Auth + Storage, US-East-1)</li>
          <li>Netlify (hosting + CDN)</li>
          <li>Anthropic / OpenAI / Google AI (LLM calls — under no-training contracts)</li>
          <li>Stripe (payments)</li>
          <li>Resend (transactional email)</li>
          <li>Sentry (error tracking, optional)</li>
        </ul>
      </Section>

      <Section title="Tenant isolation">
        Every multi-tenant table has Row-Level Security; orgs cannot read
        across each other. Knowledge-base files are scoped to the owning org.
      </Section>

      <Section title="Your rights">
        Export your data at <a href="/account/export-data" style={{ textDecoration: "underline" }}>/account/export-data</a>.
        Delete your account at <a href="/account/delete-account" style={{ textDecoration: "underline" }}>/account/delete-account</a>.
        Email <a href="mailto:privacy@chatquest.app" style={{ textDecoration: "underline" }}>privacy@chatquest.app</a> for anything not covered.
      </Section>

      <Section title="Children + students">
        Chatrail is FERPA-conscious for educational customers. Instructors
        and orgs configure their own consent flows; we operate as a
        &quot;school official&quot; under FERPA when an EDU customer requires it
        via a separate Data Processing Addendum.
      </Section>

      <Section title="Changes">
        We update this policy as needed. Material changes are emailed to
        active users.
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
