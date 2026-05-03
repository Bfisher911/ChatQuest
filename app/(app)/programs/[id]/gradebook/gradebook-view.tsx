"use client";

import * as React from "react";
import { Chip, Eyebrow, Icon, IconBtn } from "@/components/brutalist";
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

type FilterKind = "all" | "pending" | "graded" | "needs_revision" | "missing";
type SortKind = "name" | "pct_desc" | "pct_asc" | "needs_grading";

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
  const [filter, setFilter] = React.useState<FilterKind>("all");
  const [sort, setSort] = React.useState<SortKind>("name");
  const [query, setQuery] = React.useState("");
  const gradeByCell = new Map<string, GradeCell>();
  for (const g of grades) gradeByCell.set(`${g.learner_id}:${g.node_id}`, g);
  const openGrade = grades.find((g) => g.id === openGradeId) ?? null;

  // ─────────── Counts for the filter strip ───────────
  const counts = React.useMemo(() => {
    const c = { all: learners.length, pending: 0, graded: 0, needs_revision: 0, missing: 0 };
    for (const l of learners) {
      let hasPending = false,
        hasGraded = false,
        hasReturned = false,
        anyMissing = false;
      for (const n of nodes) {
        const g = gradeByCell.get(`${l.id}:${n.id}`);
        if (!g) {
          anyMissing = true;
          continue;
        }
        if (g.status === "pending_review") hasPending = true;
        else if (g.status === "graded") hasGraded = true;
        else if (g.status === "needs_revision") hasReturned = true;
      }
      if (hasPending) c.pending++;
      if (hasGraded) c.graded++;
      if (hasReturned) c.needs_revision++;
      if (anyMissing) c.missing++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learners, nodes, grades]);

  // ─────────── Filter + search + sort ───────────
  const visibleLearners = React.useMemo(() => {
    let out = [...learners];

    // Search by name / email (case-insensitive substring).
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((l) => {
        const name = (l.display_name ?? l.full_name ?? "").toLowerCase();
        return name.includes(q) || l.email.toLowerCase().includes(q);
      });
    }

    // Filter by activity bucket.
    if (filter !== "all") {
      out = out.filter((l) => {
        for (const n of nodes) {
          const g = gradeByCell.get(`${l.id}:${n.id}`);
          if (filter === "missing" && !g) return true;
          if (filter === "pending" && g?.status === "pending_review") return true;
          if (filter === "graded" && g?.status === "graded") return true;
          if (filter === "needs_revision" && g?.status === "needs_revision") return true;
        }
        return false;
      });
    }

    // Sort.
    if (sort === "name") {
      out.sort((a, b) => {
        const an = (a.display_name ?? a.full_name ?? a.email).toLowerCase();
        const bn = (b.display_name ?? b.full_name ?? b.email).toLowerCase();
        return an.localeCompare(bn);
      });
    } else if (sort === "pct_desc" || sort === "pct_asc") {
      const score = (lid: string) => {
        let earned = 0,
          possible = 0;
        for (const n of nodes) {
          const g = gradeByCell.get(`${lid}:${n.id}`);
          possible += Number(n.points ?? 0);
          if (g?.score != null) earned += Number(g.score);
        }
        return possible === 0 ? 0 : earned / possible;
      };
      out.sort((a, b) => (sort === "pct_desc" ? score(b.id) - score(a.id) : score(a.id) - score(b.id)));
    } else if (sort === "needs_grading") {
      // Learners with the most pending_review submissions float to the top.
      const pendingCount = (lid: string) =>
        nodes.reduce((acc, n) => acc + (gradeByCell.get(`${lid}:${n.id}`)?.status === "pending_review" ? 1 : 0), 0);
      out.sort((a, b) => pendingCount(b.id) - pendingCount(a.id));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learners, nodes, grades, filter, sort, query]);

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
          <a
            href={`/api/programs/${programId}/gradebook/csv`}
            className="cq-btn cq-btn--ghost cq-btn--sm"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="download" /> EXPORT CSV
          </a>
          <IconBtn aria-label="Settings"><Icon name="settings" /></IconBtn>
        </div>
      </div>

      {/* Filter / search / sort toolbar */}
      <div
        className="row"
        style={{
          padding: "10px 16px",
          borderBottom: "var(--hair) solid var(--ink)",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--paper)",
        }}
      >
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          ALL · {counts.all}
        </FilterPill>
        <FilterPill active={filter === "pending"} onClick={() => setFilter("pending")}>
          NEEDS GRADING · {counts.pending}
        </FilterPill>
        <FilterPill active={filter === "graded"} onClick={() => setFilter("graded")}>
          GRADED · {counts.graded}
        </FilterPill>
        <FilterPill active={filter === "needs_revision"} onClick={() => setFilter("needs_revision")}>
          REVISION · {counts.needs_revision}
        </FilterPill>
        <FilterPill active={filter === "missing"} onClick={() => setFilter("missing")}>
          MISSING WORK · {counts.missing}
        </FilterPill>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learner…"
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
            minWidth: 180,
          }}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKind)}
          style={{
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
          }}
          aria-label="Sort"
        >
          <option value="name">SORT · NAME</option>
          <option value="pct_desc">SORT · % HIGH→LOW</option>
          <option value="pct_asc">SORT · % LOW→HIGH</option>
          <option value="needs_grading">SORT · NEEDS GRADING</option>
        </select>

        {(filter !== "all" || query.trim()) && (
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
            className="cq-btn cq-btn--ghost cq-btn--sm"
            style={{ marginLeft: 4 }}
          >
            CLEAR
          </button>
        )}
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
            {visibleLearners.map((l) => {
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
            ) : visibleLearners.length === 0 ? (
              <tr>
                <td colSpan={nodes.length + 4} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                  No learners match the current filter.
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                    className="cq-btn cq-btn--ghost cq-btn--sm"
                    style={{ marginLeft: 12 }}
                  >
                    CLEAR FILTERS
                  </button>
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

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("cq-btn", "cq-btn--sm", active ? "" : "cq-btn--ghost")}
      style={{ whiteSpace: "nowrap" }}
    >
      {children}
    </button>
  );
}
