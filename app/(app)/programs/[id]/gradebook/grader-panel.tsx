"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Eyebrow, Icon, IconBtn } from "@/components/brutalist";
import { saveGrade } from "./actions";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Props {
  programId: string;
  gradeId: string;
  submissionId: string;
  learnerName: string;
  nodeTitle: string;
  maxScore: number;
  initialScore: number | null;
  initialStatus: string;
  onClose: () => void;
}

export function GraderPanel({
  programId,
  gradeId,
  submissionId,
  learnerName,
  nodeTitle,
  maxScore,
  initialScore,
  initialStatus,
  onClose,
}: Props) {
  const router = useRouter();
  const [transcript, setTranscript] = React.useState<{ role: string; content: string }[]>([]);
  const [aiSummary, setAiSummary] = React.useState<string | null>(null);
  const [aiSuggested, setAiSuggested] = React.useState<number | null>(null);
  const [perCriterion, setPerCriterion] = React.useState<{ criterion_id: string; score: number; rationale: string }[]>([]);
  const [criteria, setCriteria] = React.useState<{ id: string; name: string; max_points: number }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [score, setScore] = React.useState<string>(initialScore != null ? String(initialScore) : "");
  const [status, setStatus] = React.useState<string>(initialStatus === "pending_review" ? "graded" : initialStatus);
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: grade } = await supabase
        .from("grades")
        .select("conversation_id, instructor_comment, ai_summary, ai_suggested_score, rubric_id, node_id")
        .eq("id", gradeId)
        .maybeSingle();
      if (!grade || cancelled) return;
      setAiSummary(grade.ai_summary ?? null);
      setAiSuggested(grade.ai_suggested_score == null ? null : Number(grade.ai_suggested_score));
      if (grade.instructor_comment) setComment(grade.instructor_comment);

      const { data: msgs } = await supabase
        .from("conversation_messages")
        .select("role, content, created_at")
        .eq("conversation_id", grade.conversation_id)
        .order("created_at", { ascending: true });
      if (!cancelled) setTranscript((msgs ?? []).map((m) => ({ role: m.role, content: m.content })));

      if (grade.rubric_id) {
        const { data: cs } = await supabase
          .from("rubric_criteria")
          .select("id, name, max_points, display_order")
          .eq("rubric_id", grade.rubric_id)
          .order("display_order", { ascending: true });
        if (!cancelled) setCriteria(cs ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gradeId]);

  async function suggestAi() {
    setPending(true);
    try {
      const r = await fetch("/api/grade/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "AI suggest failed");
      setAiSummary(j.summary);
      setAiSuggested(j.total_score);
      setPerCriterion(j.per_criterion ?? []);
      if (!score) setScore(String(j.total_score));
      toast.success("AI suggestion ready.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI suggest failed");
    } finally {
      setPending(false);
    }
  }

  async function onSave() {
    setPending(true);
    const fd = new FormData();
    fd.set("gradeId", gradeId);
    fd.set("programId", programId);
    fd.set("status", status);
    fd.set("score", score);
    fd.set("maxScore", String(maxScore));
    fd.set("comment", comment);
    if (perCriterion.length > 0) {
      fd.set("perCriterion", JSON.stringify(perCriterion));
    }
    const res = await saveGrade(fd);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Grade saved.");
    router.refresh();
    onClose();
  }

  return (
    <div className="cq-grader is-open">
      <div className="cq-grader__head">
        <div>
          <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {nodeTitle.toUpperCase()}
          </div>
          <div className="cq-title-m">{learnerName}</div>
        </div>
        <IconBtn onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </IconBtn>
      </div>

      <div className="cq-grader__body">
        <Eyebrow>AI SUMMARY</Eyebrow>
        <div
          style={{
            border: "var(--hair) solid var(--ink)",
            padding: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.5,
            margin: "8px 0 18px",
          }}
        >
          {aiSummary ? aiSummary : <em style={{ color: "var(--muted)" }}>No AI summary yet.</em>}
        </div>
        <div className="row" style={{ gap: 8, marginBottom: 18 }}>
          <Btn sm ghost onClick={suggestAi} disabled={pending}>
            <Icon name="bot" /> {pending ? "ASKING…" : "GET AI SUGGESTION"}
          </Btn>
          {aiSuggested != null ? <Chip>AI: {aiSuggested}/{maxScore}</Chip> : null}
        </div>

        <Eyebrow>TRANSCRIPT</Eyebrow>
        <div
          style={{
            border: "var(--hair) solid var(--ink)",
            padding: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.4,
            maxHeight: 240,
            overflowY: "auto",
            margin: "8px 0 18px",
          }}
        >
          {loading ? (
            <em style={{ color: "var(--muted)" }}>Loading…</em>
          ) : transcript.length === 0 ? (
            <em style={{ color: "var(--muted)" }}>No messages.</em>
          ) : (
            transcript.map((m, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9, marginBottom: 4 }}>
                  ■ {m.role.toUpperCase()}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))
          )}
        </div>

        {criteria.length > 0 ? (
          <>
            <div className="row-between" style={{ alignItems: "center", marginTop: 4 }}>
              <Eyebrow>RUBRIC · {criteria.length} CRITERIA</Eyebrow>
              <Btn
                sm
                ghost
                onClick={() => {
                  // Sum per-criterion scores into the total field. Skips
                  // missing entries (treated as 0 in the sum).
                  const total = criteria.reduce((acc, c) => {
                    const pc = perCriterion.find((p) => p.criterion_id === c.id);
                    return acc + (pc?.score ?? 0);
                  }, 0);
                  setScore(String(total));
                  toast.success(`Total set to ${total}.`);
                }}
              >
                <Icon name="check" /> SUM TO TOTAL
              </Btn>
            </div>
            <div className="cq-rubric" style={{ marginTop: 8 }}>
              {criteria.map((c) => {
                const pc = perCriterion.find((p) => p.criterion_id === c.id);
                const score = pc?.score ?? 0;
                const rationale = pc?.rationale ?? "";
                function patch(next: { score?: number; rationale?: string }) {
                  setPerCriterion((curr) => {
                    const idx = curr.findIndex((p) => p.criterion_id === c.id);
                    const merged = {
                      criterion_id: c.id,
                      score: next.score ?? score,
                      rationale: next.rationale ?? rationale,
                    };
                    if (idx === -1) return [...curr, merged];
                    const copy = [...curr];
                    copy[idx] = merged;
                    return copy;
                  });
                }
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: 10,
                      borderBottom: "var(--hair) solid var(--ink)",
                      display: "grid",
                      gridTemplateColumns: "1fr 110px",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13 }}>
                        {c.name}
                      </div>
                      <textarea
                        value={rationale}
                        onChange={(e) => patch({ rationale: e.target.value })}
                        placeholder="Rationale (visible to learner) — optional"
                        rows={2}
                        style={{
                          marginTop: 6,
                          width: "100%",
                          padding: "6px 8px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          border: "var(--hair) solid var(--ink)",
                          background: "var(--paper)",
                          resize: "vertical",
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={c.max_points}
                        step="0.5"
                        value={score}
                        onChange={(e) => patch({ score: Number(e.target.value) })}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          fontFamily: "var(--font-sans)",
                          fontSize: 18,
                          fontWeight: 800,
                          textAlign: "right",
                          border: "var(--hair) solid var(--ink)",
                          background: "var(--paper)",
                        }}
                      />
                      <div
                        className="cq-mono"
                        style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 4 }}
                      >
                        / {c.max_points}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="cq-field" style={{ marginTop: 16 }}>
          <label htmlFor="comment">Instructor comment</label>
          <textarea id="comment" className="cq-textarea" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
          <div className="cq-field">
            <label htmlFor="score">Score / {maxScore}</label>
            <input
              id="score"
              type="number"
              min={0}
              max={maxScore}
              step="0.5"
              className="cq-input"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
          <div className="cq-field">
            <label htmlFor="status">Status</label>
            <select id="status" className="cq-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="graded">Graded</option>
              <option value="needs_revision">Return for Revision</option>
              <option value="excused">Excused</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cq-grader__foot">
        <Btn sm ghost onClick={onClose}>
          CANCEL
        </Btn>
        <Btn sm onClick={onSave} disabled={pending}>
          {pending ? "SAVING…" : "SAVE GRADE"} <Icon name="check" />
        </Btn>
      </div>
    </div>
  );
}
