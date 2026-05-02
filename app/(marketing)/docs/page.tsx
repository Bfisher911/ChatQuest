import * as React from "react";
import Link from "next/link";
import { Cassette, Eyebrow } from "@/components/brutalist";

export const metadata = {
  title: "Chatrail — Docs",
  description:
    "Quickstart guides for instructors and learners, knowledge-base concepts, rubric authoring, and certificate verification.",
};

export const revalidate = 3600;

const SECTIONS = [
  {
    href: "/docs/quickstart-instructor",
    title: "INSTRUCTOR QUICKSTART",
    meta: "FROM ZERO TO FIRST CHATBOT NODE IN 10 MINUTES.",
  },
  {
    href: "/docs/quickstart-learner",
    title: "LEARNER QUICKSTART",
    meta: "WHAT TO EXPECT FROM A CHATBOT-BASED COURSE.",
  },
  {
    href: "/docs/knowledge-base",
    title: "KNOWLEDGE BASE + RAG",
    meta: "UPLOAD, INDEX, CITE — HOW IT WORKS.",
  },
  {
    href: "/docs/rubrics",
    title: "RUBRIC AUTHORING",
    meta: "BUILD CRITERIA-BASED GRADING THAT THE AI CAN SUGGEST AGAINST.",
  },
  {
    href: "/docs/certificates",
    title: "CERTIFICATES",
    meta: "AUTO-AWARDS, VERIFICATION CODES, PUBLIC VERIFY PAGE.",
  },
  {
    href: "/docs/changelog",
    title: "CHANGELOG",
    meta: "WHAT'S SHIPPED, BY DATE.",
  },
];

export default function DocsHome() {
  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <Eyebrow>DOCS · 00000001</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        DOCUMENTATION.
      </h1>
      <div className="cq-grid cq-grid--3">
        {SECTIONS.map((s, i) => (
          <Cassette
            key={s.href}
            small
            index={i + 1}
            indexWidth={4}
            title={s.title}
            meta={s.meta}
            href={s.href}
          />
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 32 }}>
        Found something inaccurate? Open an issue at{" "}
        <Link href="https://github.com/Bfisher911/Chatrail" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
          github.com/Bfisher911/Chatrail
        </Link>
        .
      </p>
    </div>
  );
}
