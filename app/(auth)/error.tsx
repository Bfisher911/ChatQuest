"use client";

import * as React from "react";
import Link from "next/link";
import { Btn, Eyebrow, Icon } from "@/components/brutalist";

export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="cq-auth">
      <div className="cq-auth__form">
        <Eyebrow>AUTH ERROR</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
          SOMETHING BROKE.
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", marginBottom: 16 }}>{error.message}</p>
        <div className="row" style={{ gap: 8 }}>
          <Btn onClick={reset}>TRY AGAIN <Icon name="arrow" /></Btn>
          <Btn ghost asChild>
            <Link href="/login">SIGN IN</Link>
          </Btn>
        </div>
      </div>
      <div className="cq-auth__art" />
    </div>
  );
}
