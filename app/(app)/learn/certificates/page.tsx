import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Btn, Icon, Frame, Cassette } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function LearnerCertificatesPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: rawAwards } = await supabase
    .from("certificate_awards")
    .select(
      "id, awarded_at, verification_code, certificate:certificates(title, program:programs(id, title)), organization:organizations(name)",
    )
    .eq("learner_id", session.user.id)
    .order("awarded_at", { ascending: false });

  type AwardRow = {
    id: string;
    awarded_at: string;
    verification_code: string;
    certificate:
      | { title: string; program: { id: string; title: string }[] | { id: string; title: string } | null }[]
      | { title: string; program: { id: string; title: string }[] | { id: string; title: string } | null }
      | null;
    organization: { name: string }[] | { name: string } | null;
  };

  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const awards = ((rawAwards ?? []) as unknown as AwardRow[]).map((a) => {
    const cert = pickOne(a.certificate);
    const program = pickOne(cert?.program ?? null);
    const org = pickOne(a.organization);
    return {
      id: a.id,
      title: cert?.title ?? "Certificate of Completion",
      programTitle: program?.title ?? "—",
      programId: program?.id ?? null,
      orgName: org?.name ?? "—",
      verificationCode: a.verification_code,
      awardedAt: a.awarded_at,
    };
  });

  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <Eyebrow>YOUR CERTIFICATES</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        EARNED.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        Every cert here is publicly verifiable at <code>/verify-cert/[code]</code> — share the
        link with employers, schools, or your portfolio.
      </p>

      {awards.length === 0 ? (
        <Frame style={{ padding: 32, textAlign: "center" }}>
          <Eyebrow>NO CERTIFICATES YET</Eyebrow>
          <div className="cq-title-m" style={{ marginTop: 12, marginBottom: 16 }}>
            COMPLETE A CHATRAIL TO EARN ONE.
          </div>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 20 }}>
            Certificates auto-issue once you finish every required node at the
            instructor&apos;s passing grade.
          </p>
          <Btn asChild>
            <Link href="/learn">
              MY CHATRAILS <Icon name="arrow" />
            </Link>
          </Btn>
        </Frame>
      ) : (
        <div className="cq-grid cq-grid--3">
          {awards.map((a, i) => (
            <Cassette
              key={a.id}
              index={i + 1}
              indexWidth={4}
              title={a.title}
              meta={`${a.orgName.toUpperCase()} · ${new Date(a.awardedAt).toISOString().slice(0, 10)}`}
              staticCard
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, marginTop: 4 }}>
                <strong>CHATRAIL</strong> · {a.programTitle}
              </div>
              <div
                className="cq-mono"
                style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, wordBreak: "break-all" }}
              >
                CODE · {a.verificationCode}
              </div>
              <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn sm asChild>
                  <a
                    href={`/api/certificates/${a.id}/pdf?v=${a.verificationCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="download" /> PDF
                  </a>
                </Btn>
                <Btn sm ghost asChild>
                  <Link href={`/verify-cert/${a.verificationCode}`} target="_blank" rel="noreferrer">
                    VERIFY
                  </Link>
                </Btn>
                {a.programId ? (
                  <Btn sm ghost asChild>
                    <Link href={`/learn/${a.programId}`}>JOURNEY</Link>
                  </Btn>
                ) : null}
              </div>
            </Cassette>
          ))}
        </div>
      )}
    </div>
  );
}
