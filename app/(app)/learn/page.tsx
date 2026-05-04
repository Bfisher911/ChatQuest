import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Cassette, CassetteStats, CassetteChips, Eyebrow, Chip, Icon } from "@/components/brutalist";
import { relativeTime } from "@/lib/utils/relative-time";

export const dynamic = "force-dynamic";

export default async function LearnHub() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("enrolled_at, program:programs(id, title, description, status, due_at)")
    .eq("user_id", session.user.id)
    .order("enrolled_at", { ascending: false });

  type EnrollRow = {
    enrolled_at: string;
    program: { id: string; title: string; description: string | null; status: string | null; due_at: string | null } | null;
  };
  const programs = ((enrollments ?? []) as unknown as EnrollRow[])
    .map((e) => e.program)
    .filter((p): p is NonNullable<EnrollRow["program"]> => Boolean(p));

  const programIds = programs.map((p) => p.id);

  // Per-program counts for progress chips. Single bulk fetch each.
  const [{ data: nodes }, { data: gradesRows }, { data: convRows }, { data: awards }] = await Promise.all([
    supabase
      .from("path_nodes")
      .select("program_id")
      .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("grades")
      .select("program_id, status")
      .eq("learner_id", session.user.id)
      .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"])
      .in("status", ["graded", "completed"]),
    supabase
      .from("conversations")
      .select("program_id, updated_at")
      .eq("learner_id", session.user.id)
      .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"])
      .order("updated_at", { ascending: false }),
    supabase
      .from("certificate_awards")
      .select("program_id")
      .eq("learner_id", session.user.id)
      .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const totalNodesByProgram = new Map<string, number>();
  for (const n of nodes ?? []) {
    totalNodesByProgram.set(n.program_id, (totalNodesByProgram.get(n.program_id) ?? 0) + 1);
  }
  const doneByProgram = new Map<string, number>();
  for (const g of gradesRows ?? []) {
    doneByProgram.set(g.program_id, (doneByProgram.get(g.program_id) ?? 0) + 1);
  }
  const lastActivityByProgram = new Map<string, string>();
  for (const r of (convRows ?? []) as { program_id: string; updated_at: string }[]) {
    if (!lastActivityByProgram.has(r.program_id)) {
      lastActivityByProgram.set(r.program_id, r.updated_at);
    }
  }
  const certsByProgram = new Map<string, number>();
  for (const a of awards ?? []) {
    certsByProgram.set(a.program_id, (certsByProgram.get(a.program_id) ?? 0) + 1);
  }

  return (
    <div className="cq-page">
      <Eyebrow>MY CHATRAILS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        LEARN.
      </h1>
      <div className="cq-grid cq-grid--3">
        {programs.map((p, i) => {
          const total = totalNodesByProgram.get(p.id) ?? 0;
          const done = doneByProgram.get(p.id) ?? 0;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const lastTs = lastActivityByProgram.get(p.id);
          const certCount = certsByProgram.get(p.id) ?? 0;
          const isDraft = p.status === "draft";
          const isArchived = p.status === "archived";
          const dueLabel = p.due_at ? new Date(p.due_at).toISOString().slice(0, 10) : null;
          return (
            <Cassette
              key={p.id}
              index={i + 1}
              title={p.title}
              meta={p.description?.slice(0, 80) ?? "—"}
              href={isDraft ? undefined : `/learn/${p.id}`}
              corner={
                isDraft ? (
                  <span style={{ opacity: 0.7 }}>NOT YET LIVE</span>
                ) : isArchived ? (
                  <span style={{ opacity: 0.7 }}>ARCHIVED</span>
                ) : pct === 100 && total > 0 ? (
                  <>
                    <Icon name="check" size={10} /> COMPLETE
                  </>
                ) : pct > 0 ? (
                  <>
                    <Icon name="play" size={10} /> ACTIVE
                  </>
                ) : (
                  "NOT STARTED"
                )
              }
            >
              <CassetteStats
                items={[
                  { v: `${pct}%`, k: "PROGRESS" },
                  { v: total, k: "NODES" },
                  { v: done, k: "DONE" },
                ]}
              />
              <CassetteChips>
                {certCount > 0 ? <Chip>{certCount} EARNED</Chip> : null}
                {dueLabel ? <Chip ghost>DUE · {dueLabel}</Chip> : null}
                {lastTs ? <Chip ghost>LAST · {relativeTime(lastTs)}</Chip> : null}
              </CassetteChips>
            </Cassette>
          );
        })}
        {programs.length === 0 && (
          <div className="cq-frame" style={{ padding: 28, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
              You haven&apos;t been enrolled in any programs yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
