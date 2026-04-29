"use client";

import { Eyebrow, Btn, Icon } from "@/components/brutalist";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="cq-shell">
      <div className="cq-page" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <Eyebrow>500 · SOMETHING BROKE</Eyebrow>
        <h1 className="cq-title-xl" style={{ marginTop: 12 }}>UNEXPECTED ERROR.</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, marginTop: 12, color: "var(--muted)", maxWidth: 600 }}>
          {error.message}
        </p>
        <div style={{ marginTop: 24 }}>
          <Btn onClick={reset}>
            TRY AGAIN <Icon name="arrow" />
          </Btn>
        </div>
      </div>
    </div>
  );
}
