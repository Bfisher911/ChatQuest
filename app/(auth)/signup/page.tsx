import * as React from "react";
import Link from "next/link";
import { SignupForm } from "./signup-form";
import { Eyebrow } from "@/components/brutalist";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { token?: string; intent?: string };
}) {
  return (
    <div className="cq-auth">
      <div className="cq-auth__form">
        <Eyebrow>
          <span data-decorative-counter>■ </span>New<span data-decorative-counter> · 00000010</span>
        </Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
          Create account.
        </h1>
        <SignupForm inviteToken={searchParams.token} intent={searchParams.intent} />
        <div style={{ marginTop: 20, fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
      <div className="cq-auth__art">
        <div>
          <Eyebrow>
            <span data-decorative-counter>■ </span>For instructors, orgs, and learners
          </Eyebrow>
          <h2>Build AI tutors. Ship them as a path.</h2>
          <p style={{ fontSize: 16, opacity: 0.85 }}>
            One platform for chatbot-native curricula. RAG knowledge bases, visual builder,
            transcript grading, and certificates — all behind the same brutalist door.
          </p>
        </div>
        <div className="cq-mono" style={{ fontSize: 12, opacity: 0.7 }} data-decorative-counter>
          PRIVATE BETA · 00000010
        </div>
      </div>
    </div>
  );
}
