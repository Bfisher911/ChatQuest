"use client";

import * as React from "react";
import Link from "next/link";
import { Cassette, Btn, Icon, Chip } from "@/components/brutalist";
import { cx } from "@/lib/utils/cx";

export interface ProgramRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  default_model: string | null;
  created_at: string;
}

type Status = "all" | "draft" | "published" | "archived";

/**
 * Client wrapper around the programs list — filter pills, name search,
 * and dynamic empty states. The server page keeps doing the actual SELECT
 * (so RLS gates correctly) and hands rows in.
 */
export function ProgramsListView({ programs }: { programs: ProgramRow[] }) {
  const [filter, setFilter] = React.useState<Status>("all");
  const [query, setQuery] = React.useState("");

  const counts = React.useMemo(() => {
    const c = { all: programs.length, draft: 0, published: 0, archived: 0 };
    for (const p of programs) {
      const s = (p.status ?? "draft") as Exclude<Status, "all">;
      if (s in c) c[s]++;
    }
    return c;
  }, [programs]);

  const visible = React.useMemo(() => {
    let out = programs;
    if (filter !== "all") {
      out = out.filter((p) => (p.status ?? "draft") === filter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((p) => {
        return (
          p.title.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
        );
      });
    }
    return out;
  }, [programs, filter, query]);

  const hasFilters = filter !== "all" || query.trim().length > 0;

  return (
    <>
      <div
        className="row"
        style={{
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
          padding: "10px 12px",
          border: "var(--hair) solid var(--ink)",
          background: "var(--paper)",
        }}
      >
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          ALL · {counts.all}
        </FilterPill>
        <FilterPill active={filter === "draft"} onClick={() => setFilter("draft")}>
          DRAFT · {counts.draft}
        </FilterPill>
        <FilterPill active={filter === "published"} onClick={() => setFilter("published")}>
          PUBLISHED · {counts.published}
        </FilterPill>
        <FilterPill active={filter === "archived"} onClick={() => setFilter("archived")}>
          ARCHIVED · {counts.archived}
        </FilterPill>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Chatrails…"
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
            minWidth: 200,
          }}
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
            className="cq-btn cq-btn--ghost cq-btn--sm"
          >
            CLEAR
          </button>
        ) : null}
      </div>

      <div className="cq-grid cq-grid--3">
        {visible.map((p, i) => (
          <Cassette
            key={p.id}
            index={i + 1}
            title={p.title}
            meta={p.description?.slice(0, 80) ?? "—"}
            href={`/programs/${p.id}`}
            corner={<>{(p.status ?? "draft").toUpperCase()}</>}
          >
            <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip ghost>{(p.default_model ?? "—").toUpperCase()}</Chip>
            </div>
          </Cassette>
        ))}
        {programs.length === 0 ? (
          <div className="cq-frame" style={{ padding: 32, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-title-m">NO CHATRAILS YET</div>
            <p style={{ fontFamily: "var(--font-mono)", margin: "12px 0 20px" }}>
              Create one to start building chatbot-native curricula.
            </p>
            <Btn asChild>
              <Link href="/programs/new">
                <Icon name="plus" /> CREATE CHATRAIL
              </Link>
            </Btn>
          </div>
        ) : visible.length === 0 ? (
          <div className="cq-frame" style={{ padding: 28, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              No Chatrails match the current filter.
            </div>
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="cq-btn cq-btn--ghost cq-btn--sm"
            >
              CLEAR FILTERS
            </button>
          </div>
        ) : null}
      </div>
    </>
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
