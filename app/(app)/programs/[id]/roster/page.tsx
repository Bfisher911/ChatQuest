import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, Frame } from "@/components/brutalist";
import { InviteForm } from "./invite-form";
import { CsvImport } from "./csv-import";
import { RevokeInviteButton, RemoveLearnerButton } from "./row-actions";
import { relativeTime } from "@/lib/utils/relative-time";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, organization_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("user_id, enrolled_at, status, user:users(email, full_name, display_name)")
    .eq("program_id", params.id);

  type Row = { user_id: string; enrolled_at: string; status: string; user: { email: string; full_name: string | null; display_name: string | null } | null };
  const learners = (enrollments ?? []) as unknown as Row[];

  // ─────────── Per-learner progress aggregates ───────────
  // Roster is usually small (<100), so we fetch all relevant rows for the
  // enrolled set and aggregate in JS rather than per-learner round-trips.
  const learnerIds = learners.map((l) => l.user_id);
  const { count: nodeCount } = await supabase
    .from("path_nodes")
    .select("id", { count: "exact", head: true })
    .eq("program_id", params.id);
  const totalNodes = nodeCount ?? 0;

  const { data: gradeRows } = learnerIds.length
    ? await supabase
        .from("grades")
        .select("learner_id, status, percentage")
        .eq("program_id", params.id)
        .in("learner_id", learnerIds)
    : { data: [] as { learner_id: string; status: string; percentage: number | string | null }[] };

  const { data: convRows } = learnerIds.length
    ? await supabase
        .from("conversations")
        .select("learner_id, updated_at, status")
        .eq("program_id", params.id)
        .in("learner_id", learnerIds)
        .order("updated_at", { ascending: false })
    : { data: [] as { learner_id: string; updated_at: string; status: string }[] };

  type Agg = {
    completed: number;
    inProgress: number;
    avgPct: number | null;
    lastActive: string | null;
  };
  const aggByLearner = new Map<string, Agg>();
  for (const id of learnerIds) {
    aggByLearner.set(id, { completed: 0, inProgress: 0, avgPct: null, lastActive: null });
  }
  const pctSums = new Map<string, { sum: number; n: number }>();
  for (const g of (gradeRows ?? []) as { learner_id: string; status: string; percentage: number | string | null }[]) {
    const a = aggByLearner.get(g.learner_id);
    if (!a) continue;
    if (g.status === "graded" || g.status === "completed") a.completed++;
    if (g.percentage != null) {
      const ps = pctSums.get(g.learner_id) ?? { sum: 0, n: 0 };
      ps.sum += Number(g.percentage);
      ps.n += 1;
      pctSums.set(g.learner_id, ps);
    }
  }
  for (const [id, ps] of pctSums) {
    const a = aggByLearner.get(id);
    if (a && ps.n > 0) a.avgPct = ps.sum / ps.n;
  }
  // First conv row per learner is the most recent (sorted desc above).
  const seen = new Set<string>();
  for (const c of (convRows ?? []) as { learner_id: string; updated_at: string; status: string }[]) {
    if (seen.has(c.learner_id)) continue;
    seen.add(c.learner_id);
    const a = aggByLearner.get(c.learner_id);
    if (a) a.lastActive = c.updated_at;
  }
  // In-progress = any conversation in 'in_progress' status that isn't already counted as completed.
  const inProgressSeen = new Set<string>();
  for (const c of (convRows ?? []) as { learner_id: string; updated_at: string; status: string }[]) {
    if (c.status === "in_progress" && !inProgressSeen.has(c.learner_id)) {
      inProgressSeen.add(c.learner_id);
      const a = aggByLearner.get(c.learner_id);
      if (a) a.inProgress++;
    }
  }

  const { data: instructors } = await supabase
    .from("program_instructors")
    .select("user_id, capacity, user:users(email, full_name, display_name)")
    .eq("program_id", params.id);
  type IRow = { user_id: string; capacity: string; user: { email: string; full_name: string | null; display_name: string | null } | null };
  const inst = (instructors ?? []) as unknown as IRow[];

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, status, expires_at, created_at")
    .eq("program_id", params.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <Eyebrow>ROSTER</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        {program.title.toUpperCase()}
      </h1>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>INVITE</Eyebrow>
        <div style={{ marginTop: 12 }}>
          <InviteForm programId={program.id} />
        </div>
        <div style={{ marginTop: 24 }}>
          <Eyebrow>BULK CSV</Eyebrow>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: "8px 0 12px" }}>
            One email per line. First column is the email; other columns are ignored.
          </p>
          <CsvImport programId={program.id} />
        </div>
      </Frame>

      <div className="row-between" style={{ marginBottom: 12, alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Eyebrow>LEARNERS · {learners.length}</Eyebrow>
        {totalNodes > 0 && learners.length > 0 ? (
          <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {learners.filter((l) => (aggByLearner.get(l.user_id)?.completed ?? 0) >= totalNodes).length} FINISHED
            {" · "}
            {learners.filter((l) => {
              const a = aggByLearner.get(l.user_id);
              return a && a.completed > 0 && a.completed < totalNodes;
            }).length} IN PROGRESS
            {" · "}
            {learners.filter((l) => (aggByLearner.get(l.user_id)?.completed ?? 0) === 0 && !aggByLearner.get(l.user_id)?.lastActive).length} NOT STARTED
          </span>
        ) : null}
      </div>
      <div className="cq-frame" style={{ marginBottom: 24 }}>
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">PROGRESS</th>
              <th className="num">AVG GRADE</th>
              <th className="num">LAST ACTIVE</th>
              <th className="num">STATUS</th>
              <th className="num">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No learners yet.
                </td>
              </tr>
            ) : (
              learners.map((l) => {
                const a = aggByLearner.get(l.user_id) ?? { completed: 0, inProgress: 0, avgPct: null, lastActive: null };
                const progressPct = totalNodes === 0 ? 0 : Math.round((a.completed / totalNodes) * 100);
                const isFinished = totalNodes > 0 && a.completed >= totalNodes;
                const notStarted = a.completed === 0 && !a.lastActive;
                return (
                  <tr key={l.user_id}>
                    <td>{l.user?.display_name ?? l.user?.full_name ?? "—"}</td>
                    <td>{l.user?.email ?? "—"}</td>
                    <td className="num">
                      {totalNodes === 0 ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : (
                        <span title={`${progressPct}% complete`}>
                          <Chip ghost={!isFinished}>
                            {a.completed} / {totalNodes}
                          </Chip>
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {a.avgPct == null ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : (
                        `${Math.round(a.avgPct)}%`
                      )}
                    </td>
                    <td className="num">
                      {a.lastActive ? (
                        <span title={new Date(a.lastActive).toISOString()}>
                          {relativeTime(a.lastActive)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td className="num">
                      <Chip ghost={!isFinished && !notStarted}>
                        {isFinished ? "DONE" : notStarted ? "NOT STARTED" : l.status.toUpperCase()}
                      </Chip>
                    </td>
                    <td className="num">
                      <RemoveLearnerButton
                        learnerUserId={l.user_id}
                        programId={program.id}
                        learnerName={l.user?.display_name ?? l.user?.full_name ?? l.user?.email ?? "this learner"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Eyebrow>INSTRUCTORS · {inst.length}</Eyebrow>
      <div className="cq-frame" style={{ marginTop: 12, marginBottom: 24 }}>
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">CAPACITY</th>
            </tr>
          </thead>
          <tbody>
            {inst.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                  None.
                </td>
              </tr>
            ) : (
              inst.map((i) => (
                <tr key={i.user_id}>
                  <td>{i.user?.display_name ?? i.user?.full_name ?? "—"}</td>
                  <td>{i.user?.email ?? "—"}</td>
                  <td className="num">
                    <Chip>{i.capacity.toUpperCase()}</Chip>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(invites ?? []).length > 0 ? (
        <>
          <Eyebrow>PENDING INVITES · {invites?.length}</Eyebrow>
          <div className="cq-frame" style={{ marginTop: 12 }}>
            <table className="cq-table">
              <thead>
                <tr>
                  <th>EMAIL</th>
                  <th className="num">ROLE</th>
                  <th className="num">EXPIRES</th>
                  <th className="num">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(invites ?? []).map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td className="num">
                      <Chip ghost>{inv.role.toUpperCase()}</Chip>
                    </td>
                    <td className="num">{new Date(inv.expires_at).toISOString().slice(0, 10)}</td>
                    <td className="num">
                      <RevokeInviteButton inviteId={inv.id} programId={program.id} email={inv.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
