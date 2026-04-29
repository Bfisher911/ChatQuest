import * as React from "react";
import { Eyebrow, Chip } from "@/components/brutalist";

export default function CertificatesPage() {
  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <Eyebrow>CERTIFICATES</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 12 }}>
        YOUR CERTIFICATES.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
        Certificate awards land in Phase 2 — milestone-triggered, brutalist PDF template, unique verification code.
      </p>
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <Chip ghost>PHASE 2</Chip>
      </div>
    </div>
  );
}
