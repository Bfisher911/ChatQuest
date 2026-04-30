import * as React from "react";
import Link from "next/link";
import { Cassette, Chip, Eyebrow, Btn, Icon } from "@/components/brutalist";

const SECTIONS = [
  {
    title: "PROGRAMS + PATHS",
    items: [
      "Programs as the top-level container — courses, training paths, simulations.",
      "Visual path builder (Phase 2): drag content / PDFs / chatbots / milestones / certs.",
      "Conditional release rules: dates, prerequisites, min-score gates, branching.",
    ],
  },
  {
    title: "CHATBOT NODES",
    items: [
      "Per-node system prompt, model, temperature, token cap, attempts, points.",
      "Pluggable models — Claude (Haiku / Sonnet / Opus) and OpenAI (gpt-4o family).",
      "Streaming responses via SSE; token usage tracked per call.",
    ],
  },
  {
    title: "RAG KNOWLEDGE",
    items: [
      "Upload PDF / TXT / MD / CSV at the program level.",
      "Auto-chunked, embedded with pgvector, cited inline in answers.",
      "Reindex on demand. Tenant-scoped: orgs never see each other's KB.",
    ],
  },
  {
    title: "GRADEBOOK + RUBRICS",
    items: [
      "Canvas-style table over chatbot transcripts.",
      "AI rubric scoring suggestion. Instructor overrides everything.",
      "Return for revision, mark excused, export CSV (Phase 2).",
    ],
  },
  {
    title: "CERTIFICATES",
    items: [
      "Auto-issued on milestone completion (Phase 2).",
      "Brutalist PDF template with org logo, instructor signature, unique verification ID.",
    ],
  },
  {
    title: "BILLING + SEATS",
    items: [
      "Plan registry seeded with free / instructor tiers / org tiers.",
      "Stripe Checkout + webhooks (Phase 3).",
      "Seat pools, soft + hard token caps, audit logs.",
    ],
  },
];

export const revalidate = 3600;

export default function FeaturesPage() {
  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <Eyebrow>FEATURES</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        WHAT&apos;S IN THE BOX.
      </h1>
      <div className="cq-grid cq-grid--2">
        {SECTIONS.map((s, i) => (
          <div key={s.title} className="cq-frame" style={{ padding: 24 }}>
            <Eyebrow>{s.title}</Eyebrow>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8 }}>
              {s.items.map((it) => (
                <li key={it} style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.4 }}>
                  ■ {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <Btn asChild>
          <Link href="/signup">
            START BUILDING <Icon name="arrow" />
          </Link>
        </Btn>
      </div>
    </div>
  );
}
