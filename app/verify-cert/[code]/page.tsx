// Public certificate verification page. No auth required — anyone can
// resolve a verification code to its certificate metadata.

import * as React from "react";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Eyebrow, Btn, Icon, Frame, Chip } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function VerifyCertPage({ params }: { params: { code: string } }) {
  const admin = createServiceRoleClient();
  const { data: award } = await admin
    .from("certificate_awards")
    .select(
      "id, awarded_at, verification_code, certificate:certificates(title, program:programs(title)), learner:users(full_name, display_name, email), organization:organizations(name)",
    )
    .eq("verification_code", params.code)
    .maybeSingle();

  if (!award) {
    return (
      <div className="cq-shell">
        <div className="cq-page" style={{ maxWidth: 720, margin: "60px auto" }}>
          <Eyebrow>VERIFICATION</Eyebrow>
          <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
            CERTIFICATE NOT FOUND.
          </h1>
          <p style={{ fontFamily: "var(--font-mono)" }}>
            No certificate matches verification code <strong>{params.code}</strong>. The
            code may have a typo, or the certificate may have been revoked.
          </p>
        </div>
      </div>
    );
  }

  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const cert = pickOne(award.certificate as unknown) as
    | { title: string; program: { title: string }[] | { title: string } | null }
    | null;
  const program = pickOne(cert?.program ?? null);
  const learner = pickOne(award.learner as unknown) as
    | { full_name: string | null; display_name: string | null; email: string }
    | null;
  const org = pickOne(award.organization as unknown) as { name: string } | null;

  return (
    <div className="cq-shell">
      <div className="cq-page" style={{ maxWidth: 760, margin: "60px auto" }}>
        <Eyebrow>VERIFICATION</Eyebrow>
        <Frame style={{ padding: 32, marginTop: 12 }}>
          <Chip>VALID</Chip>
          <h1 className="cq-title-l" style={{ marginTop: 16, marginBottom: 8 }}>
            {(cert?.title ?? "CERTIFICATE OF COMPLETION").toUpperCase()}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              color: "var(--muted)",
              marginBottom: 16,
            }}
          >
            ISSUED {new Date(award.awarded_at).toISOString().slice(0, 10)} ·{" "}
            {(org?.name ?? "Chatrail").toUpperCase()}
          </p>
          <div className="cq-grid cq-grid--2" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
            <div style={{ padding: 16, borderRight: "var(--hair) solid var(--ink)" }}>
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>RECIPIENT</div>
              <div className="cq-title-m" style={{ marginTop: 6 }}>
                {(learner?.full_name ?? learner?.display_name ?? "—").toUpperCase()}
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>PROGRAM</div>
              <div className="cq-title-m" style={{ marginTop: 6 }}>
                {(program?.title ?? "").toUpperCase()}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 24 }}>
            <Btn sm asChild>
              <a href={`/api/certificates/${award.id}/pdf?v=${award.verification_code}`} target="_blank" rel="noreferrer">
                <Icon name="download" /> DOWNLOAD PDF
              </a>
            </Btn>
            <Btn sm ghost asChild>
              <Link href="/">CHATRAIL.APP</Link>
            </Btn>
          </div>
          <div style={{ marginTop: 24, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
            VERIFICATION CODE · {award.verification_code}
          </div>
        </Frame>
      </div>
    </div>
  );
}
