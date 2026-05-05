import * as React from "react";
import Link from "next/link";
import { Cassette, CassetteStats, CassetteChips, Chip, Eyebrow, Icon, IconBtn, Btn } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { OnboardingChecklist, type ChecklistItemSpec } from "@/components/dashboard/onboarding-checklist";
import { relativeTime } from "@/lib/utils/relative-time";

type Supabase = ReturnType<typeof import("@/lib/supabase/server").createClient>;

export async function InstructorDashboard({
  supabase,
  userId,
  userName,
  organizationId,
}: {
  supabase: Supabase;
  userId: string;
  userName: string;
  organizationId: string | null;
}) {
  // Programs the instructor created or co-instructs
  const { data: ownPrograms } = await supabase
    .from("programs")
    .select(
      "id, title, description, status, created_at, default_model, organization_id",
    )
    .eq("organization_id", organizationId ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false });

  const programIds = (ownPrograms ?? []).map((p) => p.id);

  // Per-program counts
  const { data: enrollmentCounts } = await supabase
    .from("program_enrollments")
    .select("program_id, status")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: nodeCounts } = await supabase
    .from("path_nodes")
    .select("program_id, type")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: pendingGrades } = await supabase
    .from("conversations")
    .select("program_id, status")
    .eq("status", "submitted")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]);

  // Completion data: graded submissions per program (used to compute % done).
  const { data: gradedRows } = await supabase
    .from("grades")
    .select("program_id, status")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"])
    .in("status", ["graded", "completed"]);

  // Most-recent activity per program — used to surface stale Chatrails.
  const { data: lastActivityRows } = await supabase
    .from("conversations")
    .select("program_id, updated_at")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"])
    .order("updated_at", { ascending: false });

  // Cert awards per program — finally wires the CERTIFICATES stat for real.
  const { data: certRows } = await supabase
    .from("certificate_awards")
    .select("program_id")
    .in("program_id", programIds.length ? programIds : ["00000000-0000-0000-0000-000000000000"]);

  // Aggregate
  const enrollByProgram = new Map<string, number>();
  for (const e of enrollmentCounts ?? []) {
    enrollByProgram.set(e.program_id, (enrollByProgram.get(e.program_id) ?? 0) + 1);
  }
  const nodesByProgram = new Map<string, number>();
  for (const n of nodeCounts ?? []) {
    nodesByProgram.set(n.program_id, (nodesByProgram.get(n.program_id) ?? 0) + 1);
  }
  const pendingByProgram = new Map<string, number>();
  for (const p of pendingGrades ?? []) {
    pendingByProgram.set(p.program_id, (pendingByProgram.get(p.program_id) ?? 0) + 1);
  }
  const gradedByProgram = new Map<string, number>();
  for (const g of gradedRows ?? []) {
    gradedByProgram.set(g.program_id, (gradedByProgram.get(g.program_id) ?? 0) + 1);
  }
  const lastActivityByProgram = new Map<string, string>();
  for (const a of (lastActivityRows ?? []) as { program_id: string; updated_at: string }[]) {
    if (!lastActivityByProgram.has(a.program_id)) {
      lastActivityByProgram.set(a.program_id, a.updated_at);
    }
  }
  const certsByProgram = new Map<string, number>();
  for (const c of certRows ?? []) {
    certsByProgram.set(c.program_id, (certsByProgram.get(c.program_id) ?? 0) + 1);
  }
  const totalLearners = enrollmentCounts?.length ?? 0;
  const totalCertificates = certRows?.length ?? 0;

  // Build the first-run checklist (Phase B). Hidden once everything's checked.
  const firstProgram = ownPrograms?.[0];
  const firstProgramId = firstProgram?.id;
  const { data: firstNode } = firstProgramId
    ? await supabase
        .from("path_nodes")
        .select("id")
        .eq("program_id", firstProgramId)
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: firstKb } = firstProgramId
    ? await supabase
        .from("knowledge_files")
        .select("id, status")
        .in("collection_id", (
          await supabase
            .from("knowledge_collections")
            .select("id")
            .eq("program_id", firstProgramId)
        ).data?.map((c) => c.id) ?? ["00000000-0000-0000-0000-000000000000"])
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: firstInvite } = firstProgramId
    ? await supabase
        .from("invites")
        .select("id")
        .eq("program_id", firstProgramId)
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: firstSubmission } = firstProgramId
    ? await supabase
        .from("submissions")
        .select("id")
        .eq("program_id", firstProgramId)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const checklist: ChecklistItemSpec[] = [
    {
      key: "create_program",
      label: "Create your first Chatrail",
      done: !!firstProgram,
      href: "/programs/new",
      cta: "NEW CHATRAIL",
    },
    {
      key: "add_node",
      label: "Add a chatbot node to the Chatrail",
      done: !!firstNode,
      href: firstProgramId ? `/programs/${firstProgramId}/nodes/new` : "/programs",
      cta: "ADD NODE",
    },
    {
      key: "upload_kb",
      label: "Upload a knowledge-base document",
      done: !!firstKb,
      href: firstProgramId ? `/programs/${firstProgramId}/kb` : "/programs",
      cta: "UPLOAD",
    },
    {
      key: "invite_learner",
      label: "Invite a learner",
      done: !!firstInvite,
      href: firstProgramId ? `/programs/${firstProgramId}/roster` : "/programs",
      cta: "INVITE",
    },
    {
      key: "first_submission",
      label: "Get your first submission",
      done: !!firstSubmission,
      href: firstProgramId ? `/programs/${firstProgramId}/gradebook` : "/programs",
      cta: "OPEN GRADEBOOK",
    },
  ];

  const stats = [
    { k: "ACTIVE CHATRAILS", v: bin(ownPrograms?.length ?? 0, 8).slice(2) },
    { k: "LEARNERS", v: String(totalLearners) },
    { k: "PENDING REVIEWS", v: String(pendingGrades?.length ?? 0) },
    { k: "CERTIFICATES", v: String(totalCertificates) },
  ];

  return (
    <div className="cq-page">
      <OnboardingChecklist items={checklist} />
      <div className="cq-frame" style={{ padding: 28, marginBottom: 24, position: "relative" }}>
        <div className="cq-cassette__corner">
          <Icon name="lock" size={10} /> INSTRUCTOR
        </div>
        <div className="cq-mono" style={{ fontSize: 18, marginBottom: 12 }}>
          {bin(2, 8)}
        </div>
        <h1 className="cq-title-l" style={{ marginBottom: 8 }}>
          GOOD MORNING, {userName.toUpperCase()}.
        </h1>
        <div className="cq-mono" style={{ fontSize: 14, marginBottom: 20, color: "var(--muted)" }}>
          {pendingGrades?.length ? `${pendingGrades.length} SUBMISSIONS AWAIT REVIEW` : "ALL CAUGHT UP"}
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
              <div
                className="cq-mono"
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
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
        <div className="row" style={{ gap: 16 }}>
          <Eyebrow>CHATRAILS</Eyebrow>
          <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }} data-decorative-count>
            {ownPrograms?.length ?? 0} TOTAL
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn title="Grid" aria-label="Grid">
            <Icon name="grid" />
          </IconBtn>
          <IconBtn title="List" aria-label="List">
            <Icon name="list" />
          </IconBtn>
          <Btn sm ghost asChild title="One prompt → 3–7 node Chatrail draft">
            <Link href="/programs/generate">
              <span className="cq-square" /> AI · GENERATE
            </Link>
          </Btn>
          <Btn sm asChild>
            <Link href="/programs/new">
              <Icon name="plus" /> NEW CHATRAIL
            </Link>
          </Btn>
        </div>
      </div>

      {ownPrograms?.length ? (
        <div className="cq-grid cq-grid--3" style={{ paddingBottom: 28 }}>
          {ownPrograms.map((p, i) => {
            const pending = pendingByProgram.get(p.id) ?? 0;
            const learners = enrollByProgram.get(p.id) ?? 0;
            const nodes = nodesByProgram.get(p.id) ?? 0;
            const graded = gradedByProgram.get(p.id) ?? 0;
            const possible = learners * nodes;
            const completePct = possible === 0 ? 0 : Math.round((graded / possible) * 100);
            const lastActivity = lastActivityByProgram.get(p.id);
            const status = (p.status ?? "draft") as "draft" | "published" | "archived";
            const certCount = certsByProgram.get(p.id) ?? 0;
            return (
              <Cassette
                key={p.id}
                index={i + 1}
                title={p.title}
                meta={p.description?.slice(0, 80) ?? "—"}
                href={`/programs/${p.id}`}
                corner={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {pending > 0 ? (
                      <>
                        <span className="cq-square" />
                        {pending} PENDING
                      </>
                    ) : null}
                    <span style={{ opacity: pending > 0 ? 0.6 : 1 }}>{status.toUpperCase()}</span>
                  </span>
                }
              >
                <CassetteStats
                  items={[
                    { v: learners, k: "LEARNERS" },
                    { v: possible === 0 ? "—" : `${completePct}%`, k: "COMPLETE" },
                    { v: nodes, k: "NODES" },
                  ]}
                />
                <CassetteChips>
                  <Chip>BOT</Chip>
                  {p.default_model?.includes("claude") ? <Chip ghost>CLAUDE</Chip> : <Chip ghost>GPT</Chip>}
                  {certCount > 0 ? <Chip ghost>{certCount} CERTS</Chip> : null}
                </CassetteChips>
                {lastActivity ? (
                  <div
                    className="cq-mono"
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 8,
                    }}
                    title={new Date(lastActivity).toISOString()}
                  >
                    LAST · {relativeTime(lastActivity)}
                  </div>
                ) : null}
              </Cassette>
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}


function EmptyState() {
  return (
    <div className="cq-frame" style={{ padding: 48, textAlign: "center" }}>
      <Eyebrow>NO PROGRAMS YET</Eyebrow>
      <div className="cq-title-m" style={{ marginTop: 12, marginBottom: 24 }}>
        START WITH A FRESH PROGRAM.
      </div>
      <div className="row" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        <Btn asChild>
          <Link href="/programs/generate">
            <span className="cq-square" /> AI · GENERATE FROM PROMPT
          </Link>
        </Btn>
        <Btn ghost asChild>
          <Link href="/programs/new">
            <Icon name="plus" /> CREATE BLANK
          </Link>
        </Btn>
      </div>
    </div>
  );
}
