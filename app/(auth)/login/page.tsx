import * as React from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Eyebrow } from "@/components/brutalist";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; reason?: string };
}) {
  return (
    <div className="cq-auth">
      <div className="cq-auth__form">
        <Eyebrow>■ ACCESS · 00000001</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
          SIGN IN.
        </h1>
        <LoginForm next={searchParams.next} />
        <div style={{ marginTop: 20, fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <Link href="/forgot-password">Forgot password?</Link>
          <span style={{ margin: "0 8px", color: "var(--muted)" }}>·</span>
          <Link href="/signup">Create an account</Link>
        </div>
      </div>
      <div className="cq-auth__art">
        <div>
          <Eyebrow>■ CHATRAIL</Eyebrow>
          <h2>CHATBOT-NATIVE LMS FOR SERIOUS LEARNING.</h2>
          <p style={{ fontSize: 16, opacity: 0.85 }}>
            Build AI tutors. Wire them into a visual learning path. Grade transcripts with rubrics.
            Issue certificates. The brutalist way.
          </p>
        </div>
        <div className="cq-mono" style={{ fontSize: 12, opacity: 0.7 }}>
          PRIVATE BETA · 00000001
        </div>
      </div>
    </div>
  );
}
