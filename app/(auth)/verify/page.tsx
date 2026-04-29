import * as React from "react";
import Link from "next/link";
import { Btn, Eyebrow } from "@/components/brutalist";

export default function VerifyPage() {
  return (
    <div className="cq-auth">
      <div className="cq-auth__form">
        <Eyebrow>■ EMAIL · 00000100</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
          CHECK YOUR INBOX.
        </h1>
        <p style={{ fontFamily: "var(--font-mono)" }}>
          We sent a verification link. Click it to finish creating your account, then come back and sign in.
        </p>
        <div style={{ marginTop: 20 }}>
          <Btn asChild>
            <Link href="/login">BACK TO SIGN IN</Link>
          </Btn>
        </div>
      </div>
      <div className="cq-auth__art">
        <Eyebrow>■ AWAITING CONFIRM</Eyebrow>
      </div>
    </div>
  );
}
