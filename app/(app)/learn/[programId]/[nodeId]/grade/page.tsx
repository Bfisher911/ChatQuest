import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Frame, Btn, Icon, Chip } from "@/components/brutalist";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  graded: "GRADED",
  needs_revision: "REVISION REQUESTED",
  pending_review: "AWAITING REVIEW",
  in_review: "BEING REVIEWED",
  excused: "EXCUSED",
  not_submitted: "NOT SUBMITTED",
};

export default async function LearnerGradePage({
  params,
}: {
  params: { programId: string; nodeId: string };
}) {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();
  const admin = createServiceRoleClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program) notFound();

  const { data: node } = await supabase
    .from("path_nodes")
    .select("id, title, type, points")
    .eq("id", params.nodeId)
    .maybeSingle();
  if (!node) notFound();

  // Latest grade for this learner + node.
  const { data: grade } = await supabase
    .from("grades")
    .select(
      "id, status, score, max_score, percentage, instructor_comment, ai_summary, ai_suggested_score, rubric_id, graded_at",
    )
    .eq("program_id", program.id)
    .eq("node_id", node.id)
    .eq("learner_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!grade) {
    return (
      <div className="cq-page" style={{ maxWidth: 760 }}>
        <div className="row" style={{ marginBottom: 16 }}>
          <Btn sm ghost asChild>
            <Link href={`/learn/${program.id}`}>
              <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> JOURNEY
            </Link>
          </Btn>
        </div>
        <Eyebrow>NO GRADE YET</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
          {node.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
          You haven&apos;t submitted this node yet, or your instructor hasn&apos;t graded it.
        </p>
      </div>
    );
  }

  // Per-criterion scores (use admin client because we want them via FK regardless of RLS).
  const { data: criteria } = grade.rubric_id
    ? await admin
        .from("rubric_criteria")
        .select("id, name, description, max_points, display_order")
        .eq("rubric_id", grade.rubric_id)
        .order("display_order", { ascending: true })
    : { data: [] };

  const { data: scores } = await admin
    .from("rubric_scores")
    .select("criterion_id, score, comment")
    .eq("grade_id", grade.id);
  const scoreByCrit = new Map<string, { score: number | string | null; comment: string | null }>();
  for (const s of scores ?? []) {
    scoreByCrit.set(s.criterion_id, { score: s.score, comment: s.comment });
  }

  const pct = grade.percentage == null ? null : Number(grade.percentage);
  const score = grade.score == null ? null : Number(grade.score);
  const maxScore = grade.max_score == null ? Number(node.points ?? 0) : Number(grade.max_score);
  const statusLabel = STATUS_LABEL[grade.status] ?? grade.status.toUpperCase();
  const isReturned = grade.status === "needs_revision";
  const isGraded = grade.status === "graded";

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Btn sm ghost asChild>
          <Link href={`/learn/${program.id}`}>
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> JOURNEY
          </Link>
        </Btn>
        <Chip>{program.title.toUpperCase()}</Chip>
        <Chip ghost>{node.title.toUpperCase()}</Chip>
      </div>

      <Eyebrow>YOUR GRADE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
        {statusLabel}.
      </h1>

      {/* Top score panel */}
      <Frame style={{ padding: 28, marginBottom: 24, position: "relative" }}>
        {score != null ? (
          <div className="cq-grid cq-grid--3" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
            <div style={{ padding: 18, borderRight: "var(--hair) solid var(--ink)" }}>
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                SCORE
              </div>
              <div className="cq-title-l" style={{ fontSize: 56 }}>
                {score}
                <span className="cq-mono" style={{ fontSize: 18, opacity: 0.5 }}> / {maxScore}</span>
              </div>
            </div>
            <div style={{ padding: 18, borderRight: "var(--hair) solid var(--ink)" }}>
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                PERCENTAGE
              </div>
              <div className="cq-title-l" style={{ fontSize: 56 }}>
                {pct == null ? "—" : `${Math.round(pct)}%`}
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                GRADED
              </div>
              <div className="cq-title-m" style={{ fontSize: 18, marginTop: 14 }}>
                {grade.graded_at
                  ? new Date(grade.graded_at).toISOString().slice(0, 10)
                  : "—"}
              </div>
            </div>
          </div>
        ) : (
          <p className="cq-mono" style={{ color: "var(--muted)" }}>
            {grade.status === "pending_review"
              ? "Submitted — your instructor hasn't graded this yet."
              : "No score recorded."}
          </p>
        )}
      </Frame>

      {/* Instructor comment */}
      {grade.instructor_comment ? (
        <>
          <Eyebrow>INSTRUCTOR COMMENT</Eyebrow>
          <Frame
            style={{
              padding: 20,
              marginTop: 12,
              marginBottom: 24,
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {grade.instructor_comment}
          </Frame>
        </>
      ) : null}

      {/* Rubric breakdown */}
      {(criteria ?? []).length > 0 ? (
        <>
          <Eyebrow>RUBRIC BREAKDOWN</Eyebrow>
          <Frame style={{ padding: 0, marginTop: 12, marginBottom: 24 }}>
            {(criteria ?? []).map((c, i) => {
              const s = scoreByCrit.get(c.id);
              const got = s?.score == null ? null : Number(s.score);
              const max = c.max_points;
              return (
                <div
                  key={c.id}
                  style={{
                    padding: 16,
                    borderBottom: i < (criteria ?? []).length - 1 ? "var(--hair) solid var(--ink)" : "0",
                  }}
                >
                  <div className="row-between" style={{ alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{c.name}</div>
                      {c.description ? (
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: 4,
                            lineHeight: 1.5,
                          }}
                        >
                          {c.description}
                        </div>
                      ) : null}
                      {s?.comment ? (
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            marginTop: 8,
                            padding: 8,
                            borderLeft: "3px solid var(--ink)",
                            background: "var(--soft)",
                          }}
                        >
                          {s.comment}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="cq-title-m"
                      style={{ fontSize: 22, minWidth: 100, textAlign: "right" }}
                    >
                      {got == null ? "—" : got}
                      <span className="cq-mono" style={{ fontSize: 12, opacity: 0.5 }}> / {max}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </Frame>
        </>
      ) : null}

      {/* AI summary if shared */}
      {grade.ai_summary ? (
        <>
          <Eyebrow>AI CONVERSATION SUMMARY</Eyebrow>
          <Frame
            style={{
              padding: 16,
              marginTop: 12,
              marginBottom: 24,
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "var(--muted)",
            }}
          >
            {grade.ai_summary}
          </Frame>
        </>
      ) : null}

      {/* Action row */}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {isReturned ? (
          <Btn accent asChild>
            <Link href={`/learn/${program.id}/${node.id}`}>
              <Icon name="play" /> RETRY THIS NODE
            </Link>
          </Btn>
        ) : null}
        {isGraded || grade.status === "pending_review" ? (
          <Btn ghost asChild>
            <Link href={`/learn/${program.id}/${node.id}`}>REVIEW CONVERSATION</Link>
          </Btn>
        ) : null}
        <Btn ghost asChild>
          <Link href={`/learn/${program.id}`}>BACK TO JOURNEY</Link>
        </Btn>
      </div>
    </div>
  );
}
