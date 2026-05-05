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

      {/* Single-row toolbar — Status dropdown + Search + Sort + Clear.
          The previous design used 5 filter pills which wrapped onto a
          second row on smaller screens; a status dropdown carries the
          same information (active filter + count) in one compact control.
          A discreet stat strip below the toolbar surfaces all five counts
          when no filter is active so the at-a-glance signal is preserved. */}
      <div
        className="row"
        style={{
          padding: "10px 16px",
          borderBottom: "var(--hair) solid var(--line, var(--ink))",
          gap: 8,
          alignItems: "center",
          background: "var(--paper)",
        }}
      >
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKind)}
          aria-label="Filter learners"
          className="cq-select"
          style={{
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            background: "var(--paper)",
            minWidth: 180,
          }}
        >
          <option value="all">All learners ({counts.all})</option>
          <option value="pending">Needs grading ({counts.pending})</option>
          <option value="graded">Graded ({counts.graded})</option>
          <option value="needs_revision">Revision requested ({counts.needs_revision})</option>
          <option value="missing">Missing work ({counts.missing})</option>
        </select>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learner…"
          style={{
            flex: 1,
            minWidth: 180,
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            border: "var(--hair) solid var(--line, var(--ink))",
            background: "var(--paper)",
          }}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKind)}
          aria-label="Sort"
          className="cq-select"
          style={{
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            background: "var(--paper)",
          }}
        >
          <option value="name">Sort: Name</option>
          <option value="pct_desc">Sort: % high → low</option>
          <option value="pct_asc">Sort: % low → high</option>
          <option value="needs_grading">Sort: Needs grading</option>
        </select>

        {(filter !== "all" || query.trim()) && (
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
            title="Clear filters"
            aria-label="Clear filters"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "6px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              textDecoration: "underline",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Stat strip — only shown when no filter is active. Quick visual
          signal of where attention is needed without burning toolbar space. */}
      {filter === "all" && !query.trim() && counts.all > 0 ? (
        <div
          style={{
            padding: "6px 16px",
            borderBottom: "var(--hair) solid var(--line, var(--ink))",
            background: "var(--soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>{counts.all} learners</span>
          {counts.pending > 0 ? (
            <span>
              <strong style={{ color: "var(--ink)" }}>{counts.pending}</strong> need grading
            </span>
          ) : null}
          {counts.graded > 0 ? <span>{counts.graded} graded</span> : null}
          {counts.needs_revision > 0 ? <span>{counts.needs_revision} revision requested</span> : null}
          {counts.missing > 0 ? <span>{counts.missing} missing work</span> : null}
        </div>
      ) : null}

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

