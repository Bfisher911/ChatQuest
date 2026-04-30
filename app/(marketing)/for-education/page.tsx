import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn, Icon, Chip } from "@/components/brutalist";

export const revalidate = 3600;

export default function ForEducationPage() {
  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <Eyebrow>FOR EDUCATION</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        REPLACE THE QUIZ. KEEP THE RIGOR.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, lineHeight: 1.5 }}>
        ChatQuest is built for instructors who want to assess thinking, not recall. Set up a chatbot scenario, give learners
        the rubric you&apos;ll grade them against, and read the transcript instead of a multiple-choice form.
      </p>
      <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Chip>FERPA-CONSCIOUS</Chip>
        <Chip ghost>RLS-SCOPED DATA</Chip>
        <Chip ghost>TRANSCRIPTS PRIVATE BY DEFAULT</Chip>
      </div>
      <div style={{ marginTop: 24 }}>
        <Btn asChild>
          <Link href="/signup?intent=org_admin">
            START AN ORG <Icon name="arrow" />
          </Link>
        </Btn>
      </div>
    </div>
  );
}
