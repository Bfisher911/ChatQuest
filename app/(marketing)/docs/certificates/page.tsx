import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn } from "@/components/brutalist";

export const metadata = {
  title: "Certificates — Chatrail docs",
  description: "Auto-issuance, verification codes, and the public verify page.",
};
export const revalidate = 3600;

export default function CertsDocs() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>DOCS · CERTIFICATES</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        CERTIFICATES + VERIFICATION.
      </h1>

      <p style={{ fontSize: 16, lineHeight: 1.55, marginBottom: 16 }}>
        Chatrail issues PDF certificates automatically when a learner meets
        the configured criteria. Every cert has a unique verification code
        anyone can resolve at <code>/verify-cert/[code]</code> without signing in.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>CONFIGURING A CERT</h2>
      <ol style={{ fontSize: 16, lineHeight: 1.7, paddingLeft: 24 }}>
        <li>Drop a <strong>CERTIFICATE</strong> node onto the path builder canvas.</li>
        <li>Edit the node config in the inspector — set <code>required_node_ids</code>{" "}
        (the nodes a learner must complete) and <code>min_grade_percentage</code>.</li>
        <li>Optional: <code>requires_instructor_approval = true</code> if you want a manual review before issuance.</li>
        <li>Save. The cert is now linked to a <code>certificates</code> row in the database.</li>
      </ol>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>WHEN IT TRIGGERS</h2>
      <p>
        After every <strong>SAVE GRADE</strong> click in the gradebook, and after every
        non-bot node is marked complete by a learner, the platform runs{" "}
        <code>maybeAwardCertificates()</code>. That function iterates the
        program&apos;s certs, checks each one&apos;s requirements against the learner&apos;s
        grade history, and inserts a <code>certificate_awards</code> row if eligible.
        Idempotent — won&apos;t double-award.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>THE PDF</h2>
      <p>
        Generated server-side by <code>@react-pdf/renderer</code>. Brutalist
        landscape Letter — frame border, big sans title, recipient name, program
        name, instructor signer block, verification code + verify URL printed
        at bottom-right.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>VERIFICATION</h2>
      <p>
        Anyone — employers, schools, the recipient — can paste the verification
        code at <code>/verify-cert/&lt;code&gt;</code> to see who, what, when. If the
        code is invalid or revoked, the page reports that. The verification
        flow does not require an account.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>REVOKING</h2>
      <p>
        Currently revocation is manual: a super admin deletes the
        <code> certificate_awards </code> row in the dashboard. A self-service
        revocation UI ships in a later phase.
      </p>

      <div style={{ marginTop: 32 }}>
        <Btn ghost asChild>
          <Link href="/docs">BACK TO DOCS</Link>
        </Btn>
      </div>
    </article>
  );
}
