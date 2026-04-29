"use client";

import * as React from "react";
import { Btn, Chip, Eyebrow, Icon, IconBtn } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { cx } from "@/lib/utils/cx";
import { GraderPanel } from "./grader-panel";

interface NodeCol {
  id: string;
  title: string;
  points: number | null;
}
interface Learner {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
}
export interface GradeCell {
  id: string;
  learner_id: string;
  node_id: string;
  status: string;
  score: number | string | null;
  max_score: number | string | null;
  percentage: number | string | null;
  submission_id: string;
  delivery_status: string | null;
}

export function GradebookView({
  programId,
  programTitle,
  nodes,
  learners,
  grades,
}: {
  programId: string;
  programTitle: string;
  nodes: NodeCol[];
  learners: Learner[];
  grades: GradeCell[];
}) {
  const [openGradeId, setOpenGradeId] = React.useState<string | null>(null);
  const gradeByCell = new Map<string, GradeCell>();
  for (const g of grades) gradeByCell.set(`${g.learner_id}:${g.node_id}`, g);
  const openGrade = grades.find((g) => g.id === openGradeId) ?? null;

  function statusGlyph(s: string) {
    if (s === "missing")
      return (
        <span className="cq-cell-stat cq-cell-stat--miss">
          <span className="dot" /> MISS
        </span>
      );
    if (s === "late")
      return (
        <span className="cq-cell-stat cq-cell-stat--late">
          <span className="dot" /> LATE
        </span>
      );
    if (s === "pending_review")
      return (
        <span className="cq-cell-stat">
          <span className="dot" style={{ background: "transparent", border: "2px solid currentColor" }} /> REV
        </span>
      );
    if (s === "excused")
      return (
        <span className="cq-cell-stat" style={{ opacity: 0.5 }}>
          <span className="dot" style={{ background: "transparent" }} /> EXC
        </span>
      );
    return null;
  }

  function rowTotals(learnerId: string) {
    let earned = 0;
    let possible = 0;
    for (const n of nodes) {
      const g = gradeByCell.get(`${learnerId}:${n.id}`);
      possible += Number(n.points ?? 0);
      if (g?.score != null) earned += Number(g.score);
    }
    const pct = possible === 0 ? 0 : Math.round((earned / possible) * 100);
    return { earned, possible, pct };
  }

  return (
    <div className="cq-gb">
      <div className="cq-gb__bar">
        <div className="row" style={{ gap: 16 }}>
          <Eyebrow>GRADEBOOK · {programTitle.toUpperCase()}</Eyebrow>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Chip ghost>{learners.length} LEARNERS</Chip>
          <Chip ghost>{nodes.length} COLUMNS</Chip>
          <Chip>{grades.filter((g) => g.status === "pending_review").length} PENDING</Chip>
          <IconBtn aria-label="Settings"><Icon name="settings" /></IconBtn>
        </div>
      </div>

      <div className="cq-gb__wrap">
        <table className="cq-table">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>LEARNER</th>
              {nodes.map((n, i) => (
                <th key={n.id} className="num" style={{ minWidth: 130 }}>
                  <div style={{ fontSize: 8 }}>{bin(i + 1, 4)}</div>
                  <div style={{ marginTop: 2 }}>{n.title.split(" ").slice(0, 2).join(" ")}</div>
                </th>
              ))}
              <th className="num">TOTAL</th>
              <th className="num">PCT</th>
              <th className="num">CERT</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => {
              const totals = rowTotals(l.id);
              return (
                <tr key={l.id} className={cx(openGrade?.learner_id === l.id && "is-active")}>
                  <td>
                    <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>
                      {l.display_name ?? l.full_name ?? l.email}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{l.email}</div>
                  </td>
                  {nodes.map((n) => {
                    const g = gradeByCell.get(`${l.id}:${n.id}`);
                    return (
                      <td
                        key={n.id}
                        className="num"
                        onClick={() => g && setOpenGradeId(g.id)}
                        style={{ cursor: g ? "pointer" : "default" }}
                      >
                        {g?.score != null ? (
                          <div>
                            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 18 }}>
                              {Math.round(Number(g.score))}
                            </div>
                            {g.status !== "graded" ? <div style={{ marginTop: 2 }}>{statusGlyph(g.status)}</div> : null}
                          </div>
                        ) : g ? (
                          statusGlyph(g.status) ?? "—"
                        ) : (
                          <span className="cq-cell-stat cq-cell-stat--miss">
                            <span className="dot" /> MISS
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="num" style={{ fontFamily: "var(--font-sans)", fontWeight: 800 }}>
                    {totals.earned}/{totals.possible}
                  </td>
                  <td className="num" style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 18 }}>
                    {totals.pct}%
                  </td>
                  <td className="num">
                    {totals.pct >= 80 ? <span className="cq-square" /> : <span className="cq-square cq-square--hollow" />}
                  </td>
                </tr>
              );
            })}
            {learners.length === 0 ? (
              <tr>
                <td colSpan={nodes.length + 4} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                  No learners enrolled yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {openGrade ? (
        <GraderPanel
          programId={programId}
          gradeId={openGrade.id}
          submissionId={openGrade.submission_id}
          learnerName={
            (learners.find((l) => l.id === openGrade.learner_id)?.display_name ?? "") ||
            learners.find((l) => l.id === openGrade.learner_id)?.email ||
            "Learner"
          }
          nodeTitle={nodes.find((n) => n.id === openGrade.node_id)?.title ?? ""}
          maxScore={Number(openGrade.max_score ?? nodes.find((n) => n.id === openGrade.node_id)?.points ?? 25)}
          initialScore={openGrade.score == null ? null : Number(openGrade.score)}
          initialStatus={openGrade.status}
          onClose={() => setOpenGradeId(null)}
        />
      ) : null}
    </div>
  );
}
