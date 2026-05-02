import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn } from "@/components/brutalist";

export const metadata = {
  title: "Rubric authoring — Chatrail docs",
  description: "How to write a rubric the AI can suggest scores against.",
};
export const revalidate = 3600;

export default function RubricsDocs() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>DOCS · RUBRICS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        RUBRIC AUTHORING.
      </h1>

      <p style={{ fontSize: 16, lineHeight: 1.55, marginBottom: 16 }}>
        Rubrics turn vibes into scorecards. A good rubric makes AI suggestion
        quality jump roughly 2x — the model has explicit, named, weighted
        criteria to evaluate against rather than open-ended &quot;how did they do?&quot;.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>STRUCTURE</h2>
      <ul style={{ fontSize: 16, lineHeight: 1.7, paddingLeft: 24 }}>
        <li><strong>Rubric</strong>: top-level container with name + total points.</li>
        <li><strong>Criteria</strong>: 3–6 items per rubric. Each has a name, description, and max points.</li>
        <li><strong>Levels</strong> (optional): performance bands per criterion (Exceeds / Meets / Approaches / Does Not Meet) with point values + descriptors.</li>
      </ul>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>WRITING GOOD CRITERIA</h2>
      <ul style={{ fontSize: 16, lineHeight: 1.7, paddingLeft: 24 }}>
        <li>Use action verbs: &quot;Cited&quot;, &quot;Identified&quot;, &quot;Drafted&quot;, &quot;Pushed back on&quot;.</li>
        <li>Include the count: &quot;Cited at least 2 named regulatory frameworks&quot;.</li>
        <li>Be observable: criteria the AI can verify from the transcript only.</li>
        <li>Keep weights honest. If &quot;Frameworks cited&quot; is 8 points and &quot;Public communication&quot; is 4, that should reflect actual learning priority.</li>
      </ul>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>HOW AI GRADING USES IT</h2>
      <p>
        When you click <strong>GET AI SUGGESTION</strong> in the grader panel, the model
        receives the rubric (criteria + max points + descriptions), the learner
        instructions, and the full transcript, and is asked to return strict
        JSON: per-criterion score + rationale + total. The instructor can
        accept, adjust, or override every score before saving.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>EXAMPLE — AI ETHICS RUBRIC (25 PTS)</h2>
      <ul style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7, paddingLeft: 24 }}>
        <li>Frameworks cited (8 pts) — at least 2 regulatory / ethical / statutory</li>
        <li>Counter-argument quality (7 pts) — engaged with pushback substantively</li>
        <li>Stakeholder analysis (6 pts) — identified affected populations + interests</li>
        <li>Public communication (4 pts) — drafted statement that&apos;s honest and viable</li>
      </ul>

      <div style={{ marginTop: 32 }}>
        <Btn ghost asChild>
          <Link href="/docs">BACK TO DOCS</Link>
        </Btn>
      </div>
    </article>
  );
}
