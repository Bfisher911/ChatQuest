import * as React from "react";
import Link from "next/link";
import { Cassette, CassetteStats, CassetteChips, Chip, Eyebrow, Icon, IconBtn, Btn } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { OnboardingChecklist, type ChecklistItemSpec } from "@/components/dashboard/onboarding-checklist";

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
  const totalLearners = enrollmentCounts?.length ?? 0;
  const totalCertificates = 0; // computed in Phase 2 once cert awards are wired

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
      label: "Create your first program",
      done: !!firstProgram,
      href: "/programs/new",
      cta: "NEW PROGRAM",
    },
    {
      key: "add_node",
      label: "Add a chatbot node to the program",
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
    { k: "ACTIVE PROGRAMS", v: bin(ownPrograms?.length ?? 0, 8).slice(2) },
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
          <Eyebrow>PROGRAMS</Eyebrow>
          <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
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
          <Btn sm asChild>
            <Link href="/programs/new">
              <Icon name="plus" /> NEW PROGRAM
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
            return (
              <Cassette
                key={p.id}
                index={i + 1}
                title={p.title}
                meta={p.description?.slice(0, 80) ?? "—"}
                href={`/programs/${p.id}`}
                corner={
                  pending > 0 ? (
                    <>
                      <span className="cq-square" /> {pending} PENDING
                    </>
                  ) : (
                    <>{p.status?.toUpperCase()}</>
                  )
                }
              >
                <CassetteStats
                  items={[
                    { v: learners, k: "LEARNERS" },
                    { v: "—", k: "COMPLETE" },
                    { v: nodes, k: "NODES" },
                  ]}
                />
                <CassetteChips>
                  <Chip>BOT</Chip>
                  {p.default_model?.includes("claude") ? <Chip ghost>CLAUDE</Chip> : <Chip ghost>GPT</Chip>}
                </CassetteChips>
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
      <Btn asChild>
        <Link href="/programs/new">
          <Icon name="plus" /> CREATE PROGRAM
        </Link>
      </Btn>
    </div>
  );
}
