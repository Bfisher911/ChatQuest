import * as React from "react";
import Link from "next/link";
import { Cassette, CassetteStats, CassetteChips, Chip, Eyebrow, Icon, Btn } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";

type Supabase = ReturnType<typeof import("@/lib/supabase/server").createClient>;

export async function LearnerDashboard({
  supabase,
  userId,
  userName,
}: {
  supabase: Supabase;
  userId: string;
  userName: string;
}) {
  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select(
      "program_id, status, program:programs(id, title, description, status, due_at)",
    )
    .eq("user_id", userId);

  type EnrollRow = {
    program_id: string;
    status: string;
    program: { id: string; title: string; description: string | null; status: string | null; due_at: string | null } | null;
  };
  const enrollRows = (enrollments ?? []) as unknown as EnrollRow[];
  const programs = enrollRows
    .map((e) => e.program)
    .filter((p): p is NonNullable<EnrollRow["program"]> => Boolean(p));

  // Per-program: how many nodes, how many completed
  const programIds = programs.map((p) => p.id);
  const { data: allNodes } = await supabase
    .from("path_nodes")
    .select("id, program_id, type")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]);
  const nodesByProgram = new Map<string, number>();
  for (const n of allNodes ?? []) {
    nodesByProgram.set(n.program_id, (nodesByProgram.get(n.program_id) ?? 0) + 1);
  }

  const { data: completed } = await supabase
    .from("conversations")
    .select("program_id")
    .eq("learner_id", userId)
    .in("status", ["submitted", "graded", "completed"]);
  const doneByProgram = new Map<string, number>();
  for (const c of completed ?? []) {
    doneByProgram.set(c.program_id, (doneByProgram.get(c.program_id) ?? 0) + 1);
  }

  const stats = [
    { k: "IN PROGRESS", v: String(enrollRows.filter((e) => e.status === "active").length) },
    { k: "COMPLETED", v: String(enrollRows.filter((e) => e.status === "completed").length) },
    { k: "CERTIFICATES", v: "0" },
    { k: "AVG SCORE", v: "—" },
  ];

  return (
    <div className="cq-page">
      <div className="cq-frame" style={{ padding: 28, marginBottom: 24, position: "relative" }}>
        <div className="cq-cassette__corner">
          <Icon name="lock" size={10} /> LEARNER
        </div>
        <div className="cq-mono" style={{ fontSize: 18, marginBottom: 12 }}>
          {bin(2, 8)}
        </div>
        <h1 className="cq-title-l" style={{ marginBottom: 8 }}>
          WELCOME BACK, {userName.toUpperCase()}.
        </h1>
        <div className="cq-mono" style={{ fontSize: 14, marginBottom: 20, color: "var(--muted)" }}>
          PICK UP WHERE YOU LEFT OFF
        </div>
        <div className="cq-grid cq-grid--4" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          {stats.map((s, i) => (
            <div
              key={s.k}
              style={{
                padding: 18,
                borderRight: i < stats.length - 1 ? "var(--hair) solid var(--ink)" : "0",
              }}
            >
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                {s.k}
              </div>
              <div className="cq-title-l" style={{ fontSize: 36 }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 16 }}>
        <Eyebrow>MY PROGRAMS</Eyebrow>
        <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          {programs.length} TOTAL
        </div>
      </div>

      {programs.length ? (
        <div className="cq-grid cq-grid--3" style={{ paddingBottom: 28 }}>
          {programs.map((p, i) => {
            const done = doneByProgram.get(p.id) ?? 0;
            const total = nodesByProgram.get(p.id) ?? 0;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            return (
              <Cassette
                key={p.id}
                index={i + 1}
                title={p.title}
                meta={p.description?.slice(0, 80) ?? "—"}
                href={`/learn/${p.id}`}
              >
                <CassetteStats
                  items={[
                    { v: `${pct}%`, k: "PROGRESS" },
                    { v: total, k: "NODES" },
                    { v: done, k: "DONE" },
                  ]}
                />
                <CassetteChips>
                  <Chip>BOT</Chip>
                  {p.due_at ? <Chip ghost>DUE</Chip> : null}
                </CassetteChips>
              </Cassette>
            );
          })}
        </div>
      ) : (
        <div className="cq-frame" style={{ padding: 48, textAlign: "center" }}>
          <Eyebrow>NO PROGRAMS YET</Eyebrow>
          <div className="cq-title-m" style={{ marginTop: 12, marginBottom: 24 }}>
            ASK YOUR INSTRUCTOR FOR AN INVITE.
          </div>
          <Btn asChild>
            <Link href="/learn">BROWSE</Link>
          </Btn>
        </div>
      )}
    </div>
  );
}
