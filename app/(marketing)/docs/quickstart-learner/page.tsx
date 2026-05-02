import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn, Icon } from "@/components/brutalist";

export const metadata = {
  title: "Learner quickstart — Chatrail docs",
  description: "What to expect from a chatbot-based course.",
};
export const revalidate = 3600;

export default function LearnerQuickstart() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>DOCS · LEARNER QUICKSTART</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        WHAT TO EXPECT FROM A CHATBOT COURSE.
      </h1>

      <p style={{ fontSize: 16, lineHeight: 1.55, marginBottom: 16 }}>
        Chatrail courses replace quizzes with chatbot conversations. You read,
        watch, or react to content; you talk to an AI tutor about it; the
        instructor reads your transcript and grades you against a rubric. No
        memorize-and-bubble. Show how you think.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>
        ENROLLING
      </h2>
      <p style={{ marginBottom: 16 }}>
        Your instructor sends you a link from <code>noreply@chatquest.local</code>{" "}
        (or their org domain). Click it, sign up, and you&apos;re in.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>
        THE JOURNEY
      </h2>
      <p style={{ marginBottom: 16 }}>
        On <Link href="/learn">/learn</Link>, you&apos;ll see your assigned programs.
        Each program is a path of nodes — content reads, PDFs, external links,
        chatbot conversations, milestones, and certificates. Locked nodes
        unlock as you complete prerequisites.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>
        CHATTING WITH A BOT
      </h2>
      <p style={{ marginBottom: 16 }}>
        When you open a chatbot node, read the briefing strip at the top first
        — it tells you the goal of the conversation. Type messages, get
        responses, repeat. The token meter shows how much &quot;budget&quot; you
        have left. When you&apos;re done, click <strong>SUBMIT</strong>. You can&apos;t
        edit after submission.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>
        GETTING GRADED
      </h2>
      <p style={{ marginBottom: 16 }}>
        Your instructor reviews the transcript against a rubric and saves a
        grade. You&apos;ll get an email when it&apos;s back. If they marked it{" "}
        <strong>RETURNED FOR REVISION</strong>, you can re-attempt (if your
        instructor allows attempts).
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>
        CERTIFICATES
      </h2>
      <p style={{ marginBottom: 16 }}>
        Some programs auto-issue a certificate when you complete the required
        nodes at the minimum grade. You&apos;ll get an email with a verification
        code; anyone (employer, school) can verify it at{" "}
        <code>/verify-cert/&lt;code&gt;</code> without signing in.
      </p>

      <div className="row" style={{ gap: 8, marginTop: 32 }}>
        <Btn asChild>
          <Link href="/login">SIGN IN <Icon name="arrow" /></Link>
        </Btn>
        <Btn ghost asChild>
          <Link href="/docs">BACK TO DOCS</Link>
        </Btn>
      </div>
    </article>
  );
}
