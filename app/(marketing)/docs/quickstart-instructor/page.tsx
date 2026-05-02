import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn, Icon } from "@/components/brutalist";

export const metadata = {
  title: "Instructor quickstart — Chatrail docs",
  description: "From zero to first chatbot node in 10 minutes.",
};

export const revalidate = 3600;

export default function InstructorQuickstart() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>DOCS · INSTRUCTOR QUICKSTART</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        FROM ZERO TO FIRST CHATBOT NODE IN 10 MINUTES.
      </h1>

      <Step n={1} title="Sign up">
        Visit <Link href="/signup">/signup</Link>, pick &quot;Instructor / Trainer / SME&quot;, fill
        in your name + email + password. Chatrail auto-creates a workspace
        organization for you.
      </Step>

      <Step n={2} title="Create a program">
        From the dashboard, click <strong>NEW PROGRAM</strong>. Give it a title
        and description. Pick a default chat model (Claude Haiku is the cheapest).
      </Step>

      <Step n={3} title="Open the visual builder">
        Inside the program, click the <strong>BUILDER</strong> tab. Drag a
        <strong> CHATBOT</strong> node from the left palette onto the canvas. Type a
        title.
      </Step>

      <Step n={4} title="Configure the bot">
        Click the node to open the right-side inspector. Edit the system prompt
        (what you want the AI to do), the learner-facing instructions (what
        learners read first), and the rubric (so AI grading can suggest scores).
      </Step>

      <Step n={5} title="Upload knowledge">
        Switch to the <strong>KNOWLEDGE</strong> tab. Drop a PDF / TXT / MD file.
        It auto-chunks, embeds into pgvector, and the bot will cite it inline
        in answers.
      </Step>

      <Step n={6} title="Invite a learner">
        <strong>ROSTER</strong> tab → enter an email → click <strong>INVITE</strong>.
        They get a branded email; clicking the link puts them straight into your
        program.
      </Step>

      <Step n={7} title="Grade their first submission">
        After the learner submits, the <strong>GRADEBOOK</strong> shows the
        cell with status <strong>REV</strong>. Click it. The right-side panel slides in
        with the transcript, an AI-suggested rubric score, and a comment box.
        Adjust scores, click <strong>SAVE GRADE</strong>.
      </Step>

      <Step n={8} title="Add more nodes">
        Back in the BUILDER, drag in <strong>CONTENT</strong>, <strong>PDF</strong>,{" "}
        <strong>LINK</strong>, <strong>MILESTONE</strong>, and <strong>CERTIFICATE</strong> nodes.
        Connect them with edges to define the path. Add edge conditions
        (min-score, after-prereq) for branching.
      </Step>

      <div className="row" style={{ gap: 8, marginTop: 32 }}>
        <Btn asChild>
          <Link href="/signup">START NOW <Icon name="arrow" /></Link>
        </Btn>
        <Btn ghost asChild>
          <Link href="/docs">BACK TO DOCS</Link>
        </Btn>
      </div>
    </article>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        <span className="cq-mono" style={{ marginRight: 12, color: "var(--muted)" }}>
          {String(n).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div style={{ fontSize: 16, lineHeight: 1.55 }}>{children}</div>
    </section>
  );
}
