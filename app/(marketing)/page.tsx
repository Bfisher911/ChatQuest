import * as React from "react";
import Link from "next/link";
import { Cassette, Chip, Eyebrow, Btn, Icon } from "@/components/brutalist";

// ISR — revalidate hourly. Landing page is fully static modulo plan changes.
export const revalidate = 3600;

const FEATURES = [
  {
    idx: "00000010",
    title: "VISUAL PATH BUILDER",
    chips: ["FLOW", "DRAG"],
    desc: "Drag content, PDFs, chatbots, and certificates into a node graph. Conditional unlocks, branching, milestones.",
  },
  {
    idx: "00000011",
    title: "CHATBOT NODES + RAG",
    chips: ["BOT", "VECTOR"],
    desc: "Each node is a configurable AI tutor with its own knowledge base, system prompt, rubric, and token cap.",
  },
  {
    idx: "00000100",
    title: "TRANSCRIPT GRADEBOOK",
    chips: ["GRADE", "RUBRIC"],
    desc: "Canvas-style gradebook over chatbot conversations. AI suggestions; instructor overrides everything.",
  },
  {
    idx: "00000101",
    title: "CERTIFICATES",
    chips: ["PDF", "VERIFY"],
    desc: "Auto-generate verifiable PDF certs on milestone completion. Org logo, instructor signature, unique ID.",
  },
  {
    idx: "00000110",
    title: "SEAT POOLS + STRIPE",
    chips: ["BILLING"],
    desc: "Org admins purchase seat pools. Instructors allocate. Failed payment freezes new enrollments only.",
  },
  {
    idx: "00000111",
    title: "TOKEN COST CONTROL",
    chips: ["AI", "LIMITS"],
    desc: "Per-org, per-instructor, per-program token budgets. Soft warnings, hard caps, model-tier selection.",
  },
];

const ROLES = [
  { n: "01", t: "SUPER ADMIN", m: "Platform-wide governance, org & subscription oversight." },
  { n: "02", t: "ORG ADMIN", m: "Buys plans. Allocates seats. Sees org analytics." },
  { n: "03", t: "INSTRUCTOR / SME", m: "Builds programs, bots, rubrics. Grades work." },
  { n: "04", t: "TA / CO-INSTRUCTOR", m: "Assists with grading and learner support." },
];

export default function LandingPage() {
  return (
    <div style={{ padding: 0 }}>
      <div className="cq-hero">
        <div className="cq-hero__corner">
          <Icon name="lock" size={12} /> PRIVATE BETA
        </div>
        <div>
          <div className="cq-hero__index">00000001</div>
          <h1 className="cq-hero__title">
            CHATBOT-
            <br />
            NATIVE LMS
            <br />
            FOR SERIOUS
            <br />
            LEARNING.
          </h1>
          <p className="cq-hero__sub">
            Build AI tutors. Wire them into a visual learning path. Grade transcripts with rubrics. Issue certificates.
            The brutalist way.
          </p>
        </div>
        <div className="cq-hero__row">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Chip>BOT</Chip>
            <Chip>RAG</Chip>
            <Chip>RUBRICS</Chip>
            <Chip>CERTIFICATES</Chip>
            <Chip>SEATS</Chip>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn ghost asChild>
              <Link href="/features">SEE FEATURES</Link>
            </Btn>
            <Btn asChild>
              <Link href="/signup">
                START BUILDING <Icon name="arrow" />
              </Link>
            </Btn>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 28px 28px" }}>
        <div className="row-between" style={{ marginBottom: 16 }}>
          <Eyebrow>FEATURED CAPABILITIES</Eyebrow>
          <div className="cq-mono" style={{ fontSize: 13 }} data-decorative-counter>06 / 06</div>
        </div>
        <div className="cq-grid cq-grid--3">
          {FEATURES.map((f) => (
            <Cassette
              key={f.idx}
              index={f.idx}
              title={f.title}
              meta="2026 — Present"
              corner={<Icon name="arrow" size={10} />}
              href="/signup"
            >
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.4, margin: "0 0 18px" }}>
                {f.desc}
              </p>
              <div className="cq-cassette__chips">
                {f.chips.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
              </div>
            </Cassette>
          ))}
        </div>

        <div style={{ marginTop: 32, border: "var(--frame) solid var(--ink)", padding: 24 }}>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <Eyebrow>ROLES</Eyebrow>
            <div className="cq-mono" style={{ fontSize: 12 }} data-decorative-counter>05 / 05</div>
          </div>
          <div className="cq-grid cq-grid--4" style={{ gap: 0 }}>
            {ROLES.map((r, i) => (
              <div
                key={r.n}
                style={{
                  padding: 18,
                  borderRight: i < 3 ? "var(--hair) solid var(--ink)" : "0",
                }}
              >
                <div className="cq-mono" style={{ fontSize: 14, marginBottom: 6 }}>
                  {r.n}
                </div>
                <div className="cq-title-s" style={{ marginBottom: 8 }}>
                  {r.t}
                </div>
                <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  {r.m}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "var(--hair) solid var(--ink)", marginTop: 0, paddingTop: 18 }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="cq-mono" style={{ fontSize: 14 }}>05</div>
              <div className="cq-title-s">LEARNER / TRAINEE</div>
              <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
                Moves through assigned chatbot paths, submits transcripts, earns certificates.
              </div>
              <Btn sm asChild>
                <Link href="/signup">
                  OPEN LEARNER VIEW <Icon name="arrow" />
                </Link>
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
