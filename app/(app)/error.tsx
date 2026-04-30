"use client";

import * as React from "react";
import Link from "next/link";
import { Btn, Eyebrow, Frame, Icon } from "@/components/brutalist";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  React.useEffect(() => {
    console.error("[app] route error:", error);
  }, [error]);
  return (
    <div className="cq-page" style={{ maxWidth: 720, margin: "60px auto" }}>
      <Eyebrow>SOMETHING WENT WRONG</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
        ROUTE ERROR.
      </h1>
      <Frame style={{ padding: 16, fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {error.message}
      </Frame>
      <div className="row" style={{ gap: 8, marginTop: 24 }}>
        <Btn onClick={reset}><Icon name="arrow" /> TRY AGAIN</Btn>
        <Btn ghost asChild>
          <Link href="/dashboard">DASHBOARD</Link>
        </Btn>
      </div>
    </div>
  );
}
