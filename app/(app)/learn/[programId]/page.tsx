import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Chip, Frame, Btn, Icon } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";

export const dynamic = "force-dynamic";

export default async function LearnerJourney({ params }: { params: { programId: string } }) {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description, status")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program) notFound();

  const { data: nodes } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, display_order")
    .eq("program_id", params.programId)
    .order("display_order", { ascending: true });

  const { data: convs } = await supabase
    .from("conversations")
    .select("node_id, status, attempt_number")
    .eq("program_id", params.programId)
    .eq("learner_id", session.user.id);
  const convByNode = new Map<string, { status: string; attempt: number }>();
  for (const c of convs ?? []) {
    convByNode.set(c.node_id, { status: c.status, attempt: c.attempt_number });
  }
  const total = nodes?.length ?? 0;
  const done = (nodes ?? []).filter((n) => {
    const c = convByNode.get(n.id);
    return c?.status === "graded" || c?.status === "completed" || c?.status === "submitted";
  }).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="cq-page">
      <Frame style={{ padding: 28, marginBottom: 24 }}>
        <Eyebrow>CHATRAIL · {bin(1, 8)}</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
          {program.title.toUpperCase()}
        </h1>
        {program.description ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{program.description}</p>
        ) : null}
        <div className="row" style={{ marginTop: 16, gap: 12, alignItems: "center" }}>
          <div className="cq-progressbar" style={{ width: 240 }}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="cq-mono">{pct}% · {done} OF {total} NODES</div>
        </div>
      </Frame>

      <Eyebrow>JOURNEY</Eyebrow>
      <div className="cq-grid cq-grid--3" style={{ marginTop: 16 }}>
        {(nodes ?? []).map((n, i) => {
          const c = convByNode.get(n.id);
          let status: "DONE" | "ACTIVE" | "AVAILABLE" = "AVAILABLE";
          if (c?.status === "graded" || c?.status === "completed" || c?.status === "submitted") status = "DONE";
          else if (c?.status === "in_progress") status = "ACTIVE";

          return (
            <div
              key={n.id}
              className="cq-cassette"
              style={{
                background: status === "DONE" ? "var(--soft)" : "var(--paper)",
                opacity: 1,
              }}
            >
              <div className="cq-cassette__corner">
                <span className="cq-square" /> {status}
              </div>
              <div className="cq-cassette__index">{bin(i + 1, 4)}</div>
              <h3 className="cq-cassette__title">{n.title}</h3>
              <div className="cq-cassette__meta">
                {n.type.toUpperCase()} · {n.points ?? 0} pts
              </div>
              <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
                <Btn sm asChild>
                  <Link href={`/learn/${program.id}/${n.id}`}>
                    {status === "DONE" ? "REVIEW" : status === "ACTIVE" ? "RESUME" : "START"} <Icon name="arrow" />
                  </Link>
                </Btn>
              </div>
            </div>
          );
        })}
        {(!nodes || nodes.length === 0) && (
          <div className="cq-frame" style={{ padding: 28, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
              No nodes in this program yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
