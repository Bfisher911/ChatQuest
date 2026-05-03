import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Chip, Frame, Btn, Icon } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { computeProgress, type PathNodeMin, type PathEdgeMin, type SubmissionMin, type NodeRuleMin } from "@/lib/path/progress";
import { cx } from "@/lib/utils/cx";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = {
  available: "AVAILABLE",
  in_progress: "ACTIVE",
  completed: "DONE",
  failed: "RETRY",
  locked: "LOCKED",
};

const STATE_CTA: Record<string, string> = {
  available: "START",
  in_progress: "RESUME",
  completed: "REVIEW",
  failed: "TRY AGAIN",
  locked: "LOCKED",
};

export default async function LearnerJourney({ params }: { params: { programId: string } }) {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description, status, organization_id")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program) notFound();

  // Guard: learners only see published Chatrails. Staff (instructor / TA /
  // org admin / super admin in the program's org) bypass — they need to
  // preview drafts and access archived ones for record-keeping.
  const isStaff =
    session.user.isSuperAdmin ||
    session.user.memberships.some(
      (m) =>
        m.organizationId === program.organization_id &&
        (m.role === "instructor" || m.role === "ta" || m.role === "org_admin"),
    );
  if (!isStaff && program.status !== "published") {
    return (
      <div className="cq-page" style={{ maxWidth: 720 }}>
        <Eyebrow>NOT YET AVAILABLE</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
          {program.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
          {program.status === "draft"
            ? "Your instructor is still building this Chatrail. Check back once it's published."
            : "This Chatrail has been archived. Reach out to your instructor if you need access."}
        </p>
        <div style={{ marginTop: 16 }}>
          <Btn ghost asChild>
            <Link href="/learn">
              <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> MY CHATRAILS
            </Link>
          </Btn>
        </div>
      </div>
    );
  }

  const [{ data: nodes }, { data: edges }, { data: rules }, { data: subs }] = await Promise.all([
    supabase
      .from("path_nodes")
      .select("id, type, title, points, display_order, available_at, due_at, is_required")
      .eq("program_id", params.programId)
      .order("display_order", { ascending: true }),
    supabase
      .from("path_edges")
      .select("source_node_id, target_node_id, condition")
      .eq("program_id", params.programId),
    supabase
      .from("node_rules")
      .select("node_id, rule_kind, config"),
    supabase
      .from("submissions")
      .select("node_id, attempt_number, conversation_id")
      .eq("program_id", params.programId)
      .eq("learner_id", session.user.id),
  ]);

  // Pull statuses + percentages — submissions row alone isn't enough.
  const subIds = (subs ?? []).map((s) => s.conversation_id);
  const { data: convStatuses } = await supabase
    .from("conversations")
    .select("id, status, total_prompt_tokens, total_completion_tokens")
    .in("id", subIds.length ? subIds : ["00000000-0000-0000-0000-000000000000"]);
  const statusByConv = new Map<string, string>();
  for (const c of convStatuses ?? []) statusByConv.set(c.id, c.status);

  const { data: grades } = await supabase
    .from("grades")
    .select("node_id, percentage, status")
    .eq("program_id", params.programId)
    .eq("learner_id", session.user.id);
  const gradeByNode = new Map<string, { pct: number | null; status: string }>();
  for (const g of grades ?? []) {
    gradeByNode.set(g.node_id, { pct: g.percentage == null ? null : Number(g.percentage), status: g.status });
  }

  const submissionsForEngine: SubmissionMin[] = (subs ?? []).map((s) => {
    const convStatus = statusByConv.get(s.conversation_id) ?? "in_progress";
    const grade = gradeByNode.get(s.node_id);
    let status: SubmissionMin["status"] = "in_progress";
    if (grade?.status === "graded") status = "graded";
    else if (grade?.status === "needs_revision") status = "needs_revision";
    else if (convStatus === "submitted" || convStatus === "completed") status = "submitted";
    else status = "in_progress";
    return {
      node_id: s.node_id,
      attempt_number: s.attempt_number,
      status,
      percentage: grade?.pct ?? null,
      delivery_status: null,
    };
  });

  const progress = computeProgress({
    nodes: (nodes ?? []) as PathNodeMin[],
    edges: ((edges ?? []) as unknown) as PathEdgeMin[],
    rules: ((rules ?? []) as unknown) as NodeRuleMin[],
    submissions: submissionsForEngine,
  });

  const total = nodes?.length ?? 0;
  const completedCount = Array.from(progress.values()).filter((v) => v.state === "completed").length;
  const inProgressCount = Array.from(progress.values()).filter((v) => v.state === "in_progress").length;
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  // Find the next recommended step.
  const recommended =
    (nodes ?? []).find((n) => progress.get(n.id)?.state === "in_progress") ??
    (nodes ?? []).find((n) => progress.get(n.id)?.state === "failed") ??
    (nodes ?? []).find((n) => progress.get(n.id)?.state === "available");

  return (
    <div className="cq-page">
      <Frame style={{ padding: 28, marginBottom: 24 }}>
        <Eyebrow>CHATRAIL · {bin(1, 8)}</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
          {program.title.toUpperCase()}
        </h1>
        {program.description ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", maxWidth: 760 }}>
            {program.description}
          </p>
        ) : null}

        <div className="row" style={{ marginTop: 18, gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="cq-progressbar" style={{ width: 280 }}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="cq-mono">
            {pct}% · {completedCount} / {total} COMPLETE
          </div>
          {inProgressCount > 0 ? <Chip ghost>{inProgressCount} IN PROGRESS</Chip> : null}
        </div>

        {recommended ? (
          <div
            className="row"
            style={{
              marginTop: 20,
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              padding: 14,
              background: "var(--soft)",
              border: "var(--hair) solid var(--ink)",
            }}
          >
            <Eyebrow>NEXT STEP</Eyebrow>
            <span className="cq-title-s">{recommended.title.toUpperCase()}</span>
            <Chip ghost>{recommended.type.toUpperCase()}</Chip>
            <span style={{ marginLeft: "auto" }}>
              <Btn sm asChild>
                <Link href={`/learn/${program.id}/${recommended.id}`}>
                  {STATE_CTA[progress.get(recommended.id)?.state ?? "available"]} <Icon name="arrow" />
                </Link>
              </Btn>
            </span>
          </div>
        ) : completedCount === total && total > 0 ? (
          <div
            className="row"
            style={{
              marginTop: 20,
              gap: 12,
              alignItems: "center",
              padding: 14,
              background: "var(--ink)",
              color: "var(--paper)",
            }}
          >
            <Eyebrow>■ CHATRAIL COMPLETE</Eyebrow>
            <span className="cq-mono" style={{ marginLeft: "auto" }}>
              CHECK FOR YOUR CERTIFICATE BELOW
            </span>
          </div>
        ) : null}
      </Frame>

      <Eyebrow>JOURNEY</Eyebrow>
      <div className="cq-grid cq-grid--3" style={{ marginTop: 16 }}>
        {(nodes ?? []).map((n, i) => {
          const p = progress.get(n.id);
          const state = p?.state ?? "locked";
          const stateLabel = STATE_LABEL[state] ?? state.toUpperCase();
          const ctaLabel = STATE_CTA[state] ?? "OPEN";
          const isLocked = state === "locked";
          const isDone = state === "completed";
          const isFailed = state === "failed";

          return (
            <div
              key={n.id}
              className={cx("cq-cassette")}
              style={{
                background: isDone ? "var(--soft)" : "var(--paper)",
                opacity: isLocked ? 0.55 : 1,
              }}
            >
              <div className="cq-cassette__corner">
                {state === "completed" ? (
                  <>
                    <Icon name="check" size={10} /> DONE
                  </>
                ) : state === "in_progress" ? (
                  <>
                    <Icon name="play" size={10} /> ACTIVE
                  </>
                ) : state === "failed" ? (
                  <>
                    <span className="cq-square" /> RETRY
                  </>
                ) : state === "locked" ? (
                  <>
                    <Icon name="lock" size={10} /> LOCKED
                  </>
                ) : (
                  <>
                    <span className="cq-square cq-square--hollow" /> {stateLabel}
                  </>
                )}
              </div>
              <div className="cq-cassette__index">{bin(i + 1, 4)}</div>
              <h3 className="cq-cassette__title">{n.title}</h3>
              <div className="cq-cassette__meta">
                {n.type.toUpperCase()} · {n.points ?? 0} pts
              </div>

              {p?.score_percentage != null && state === "completed" ? (
                <div className="cq-mono" style={{ fontSize: 13, marginTop: 4 }}>
                  SCORE · {Math.round(p.score_percentage)}%
                </div>
              ) : null}
              {p?.reasons && p.reasons.length > 0 && state === "locked" ? (
                <div
                  className="cq-mono"
                  style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}
                >
                  {p.reasons[0]}
                </div>
              ) : null}

              <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {isLocked ? (
                  <Btn sm ghost disabled>
                    <Icon name="lock" /> LOCKED
                  </Btn>
                ) : (
                  <Btn sm={!isFailed} accent={isFailed} asChild>
                    <Link href={`/learn/${program.id}/${n.id}`}>
                      {ctaLabel} <Icon name="arrow" />
                    </Link>
                  </Btn>
                )}
                {(isDone || isFailed) && n.type === "bot" ? (
                  <Btn sm ghost asChild>
                    <Link href={`/learn/${program.id}/${n.id}/grade`}>VIEW GRADE</Link>
                  </Btn>
                ) : null}
              </div>
            </div>
          );
        })}
        {(!nodes || nodes.length === 0) && (
          <div className="cq-frame" style={{ padding: 28, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
              No nodes in this Chatrail yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
