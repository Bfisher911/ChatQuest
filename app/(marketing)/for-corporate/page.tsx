import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn, Icon, Chip } from "@/components/brutalist";

export default function ForCorporatePage() {
  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <Eyebrow>FOR CORPORATE TRAINING</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        ROLE-PLAY THE HARD CONVERSATIONS.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, lineHeight: 1.5 }}>
        Stand up a chatbot for objection handling, customer support, compliance, leadership scenarios — anything where your
        team learns by doing it. Wire your knowledge base in, set the rubric, and see who&apos;s ready.
      </p>
      <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Chip>SEAT POOLS</Chip>
        <Chip ghost>SSO (PHASE 3)</Chip>
        <Chip ghost>USAGE ANALYTICS</Chip>
      </div>
      <div style={{ marginTop: 24 }}>
        <Btn asChild>
          <Link href="/signup?intent=org_admin">
            BOOK A WORKSPACE <Icon name="arrow" />
          </Link>
        </Btn>
      </div>
    </div>
  );
}
