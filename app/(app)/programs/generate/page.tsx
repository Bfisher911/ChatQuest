import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Btn, Icon, Chip, Frame } from "@/components/brutalist";
import { GenerateChatrailForm } from "./generate-form";

export const dynamic = "force-dynamic";

export default async function GenerateChatrailPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    redirect("/dashboard");
  }

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Btn sm ghost asChild>
          <Link href="/programs">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> CHATRAILS
          </Link>
        </Btn>
        <Chip>AI · BETA</Chip>
      </div>

      <Eyebrow>GENERATE A CHATRAIL</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        DESCRIBE WHAT YOU WANT TO TEACH.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--muted)",
          marginBottom: 24,
          maxWidth: 720,
          lineHeight: 1.6,
        }}
      >
        Type a brief — one paragraph is plenty — and an AI curriculum
        designer will draft a complete Chatrail: 3–7 chatbot nodes with
        pre-written system prompts, learner-facing instructions, and a linear
        flow connecting them. The Chatrail lands in DRAFT so you can tweak
        every bot, reorder nodes, swap models, and publish when ready.
      </p>

      <GenerateChatrailForm />

      <Frame style={{ padding: 20, marginTop: 28 }}>
        <Eyebrow>EXAMPLES</Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {EXAMPLES.map((ex) => (
            <ExampleCard key={ex.title} {...ex} />
          ))}
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            marginTop: 12,
          }}
        >
          Click any example to load it into the prompt above. Edit before
          generating.
        </p>
      </Frame>

      <Frame style={{ padding: 20, marginTop: 16, background: "var(--soft)" }}>
        <Eyebrow>WHAT GETS GENERATED</Eyebrow>
        <ul
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.7,
            margin: "10px 0 0",
            paddingLeft: 18,
          }}
        >
          <li>A Chatrail title + learner-facing description</li>
          <li>3–7 nodes (mostly bots) with varied pedagogical roles</li>
          <li>System prompt + persona for every bot</li>
          <li>Learner-facing briefing for every node</li>
          <li>Sensible defaults: model, token budget, attempts, temperature</li>
          <li>Linear edges connecting nodes in order</li>
          <li>Default model picks Sonnet for depth, Haiku for cost-sensitive cohorts</li>
        </ul>
      </Frame>

      <Frame style={{ padding: 20, marginTop: 16 }}>
        <Eyebrow>WHAT YOU EDIT AFTER</Eyebrow>
        <ul
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.7,
            margin: "10px 0 0",
            paddingLeft: 18,
          }}
        >
          <li>Each bot&apos;s system prompt + learner instructions in the node editor</li>
          <li>Models / token budgets / attempts per bot (with live cost estimate)</li>
          <li>Test each bot inline with the PREVIEW CHAT panel</li>
          <li>Reorder, branch, or rebuild the graph in the visual builder</li>
          <li>Attach KB docs, rubrics, certificates</li>
          <li>Status: PUBLISH when ready, ARCHIVE later, DELETE if abandoned</li>
        </ul>
      </Frame>
    </div>
  );
}

function ExampleCard({ title, prompt }: { title: string; prompt: string }) {
  return (
    <button
      type="button"
      data-example-prompt={prompt}
      className="cq-example-card"
      style={{
        textAlign: "left",
        padding: 12,
        border: "var(--hair) solid var(--ink)",
        background: "var(--paper)",
        cursor: "pointer",
        font: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13 }}>{title}</div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.5,
          // Clamp the preview so the cards stay roughly equal height.
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }}
      >
        {prompt}
      </div>
    </button>
  );
}

const EXAMPLES = [
  {
    title: "Stoic philosophy intro",
    prompt:
      "A 5-node Chatrail introducing Stoic philosophy to undergraduates. Include a Socratic discussion bot on Marcus Aurelius, a debate bot defending Stoicism against modern critics, a reflection bot helping the learner apply Stoic practices to their own life, a content reading on the dichotomy of control, and a final assessment bot where the learner explains a core concept in their own words.",
  },
  {
    title: "JavaScript debugging skills",
    prompt:
      "Teach a junior engineer how to debug JavaScript like a senior. 4 bots: 1) a stack-trace explainer that walks through real errors, 2) a Socratic root-cause bot that refuses to give the answer, 3) a console-log strategy coach, 4) a final mock-interview bot grilling the learner on a hypothetical bug. Cohort is cost-sensitive, prefer Haiku.",
  },
  {
    title: "Sales discovery call practice",
    prompt:
      "B2B SaaS sales rep onboarding. Three role-play bots: a skeptical CTO, a price-conscious procurement lead, and a champion who needs internal selling tactics. Plus one debrief bot that gives feedback on the rep's questioning technique. The rep should feel real friction.",
  },
  {
    title: "Patient-consult simulation",
    prompt:
      "Medical student practice taking patient histories. 3 simulation bots representing different presentations: chest pain (rule-out cardiac), abdominal pain (could be many things), and a vague fatigue complaint with hidden depression. Each bot stays in patient-role unless asked clinically appropriate questions. End with a reflection bot.",
  },
  {
    title: "Creative writing workshop",
    prompt:
      "Help adult learners draft a short story. 4 bots: a brainstorming partner exploring premise, a conflict-and-stakes coach, a dialogue revision editor, and a final read-aloud reviewer who reads the story back and asks one penetrating question. Use Sonnet for depth.",
  },
  {
    title: "Constitutional law moot court",
    prompt:
      "Law school 1L exercise on First Amendment doctrine. Two bots representing opposing counsel arguing a new compelled-speech case, plus a chief justice bot who asks tough hypotheticals. Final bot grades the student's strongest argument and weakest. Lean rigorous, low temperature.",
  },
];
