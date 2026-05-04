import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { startConversation } from "../../actions";
import { ChatScreen } from "@/components/chat/chat-screen";
import { Eyebrow, Btn, Icon } from "@/components/brutalist";
import {
  ContentNodeView,
  PdfNodeView,
  LinkNodeView,
  MilestoneNodeView,
  CertNodeView,
} from "@/components/learn/non-bot-node";
import {
  computeProgress,
  type PathNodeMin,
  type PathEdgeMin,
  type SubmissionMin,
  type NodeRuleMin,
} from "@/lib/path/progress";

export const dynamic = "force-dynamic";

export default async function LearnNodePage({
  params,
}: {
  params: { programId: string; nodeId: string };
}) {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, status, organization_id")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program) notFound();

  // Guard: learners only enter published Chatrails. Staff (instructor / TA /
  // org admin in the program's org, or super admin) bypass so they can
  // preview drafts and review archived ones.
  const isStaff =
    session.user.isSuperAdmin ||
    session.user.memberships.some(
      (m) =>
        m.organizationId === program.organization_id &&
        (m.role === "instructor" || m.role === "ta" || m.role === "org_admin"),
    );
  if (!isStaff && program.status !== "published") {
    return (
      <div className="cq-page" style={{ maxWidth: 720 }}>
        <Eyebrow>NOT YET AVAILABLE</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
          {program.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
          {program.status === "draft"
            ? "Your instructor is still building this Chatrail. Check back once it's published."
            : "This Chatrail has been archived. Reach out to your instructor if you need access."}
        </p>
        <div style={{ marginTop: 16 }}>
          <Btn ghost asChild>
            <Link href="/learn">
              <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> MY CHATRAILS
            </Link>
          </Btn>
        </div>
      </div>
    );
  }

  const { data: node } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, due_at, config")
    .eq("id", params.nodeId)
    .maybeSingle();
  if (!node) notFound();

  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id")
    .eq("program_id", params.programId)
    .eq("node_id", params.nodeId)
    .eq("learner_id", session.user.id)
    .maybeSingle();
  const alreadyComplete = !!existingSubmission;

  // ─────────── Non-bot node type dispatch ───────────
  if (node.type === "content") {
    const cfg = (node.config as { body_html?: string; reading_minutes?: number | null }) ?? {};
    return (
      <ContentNodeView
        programId={program.id}
        nodeId={node.id}
        title={node.title}
        alreadyComplete={alreadyComplete}
        bodyHtml={cfg.body_html ?? "<p><em>No content yet.</em></p>"}
        readingMinutes={cfg.reading_minutes ?? null}
      />
    );
  }
  if (node.type === "pdf") {
    const cfg = (node.config as { storage_path?: string; filename?: string }) ?? {};
    let signedUrl: string | null = null;
    if (cfg.storage_path) {
      const admin = createServiceRoleClient();
      const { data: signed } = await admin.storage
        .from("node-files")
        .createSignedUrl(cfg.storage_path, 60 * 60);
      signedUrl = signed?.signedUrl ?? null;
    }
    return (
      <PdfNodeView
        programId={program.id}
        nodeId={node.id}
        title={node.title}
        alreadyComplete={alreadyComplete}
        signedUrl={signedUrl}
        filename={cfg.filename ?? "document.pdf"}
      />
    );
  }
  if (node.type === "link") {
    const cfg = (node.config as { url?: string; description?: string }) ?? {};
    return (
      <LinkNodeView
        programId={program.id}
        nodeId={node.id}
        title={node.title}
        alreadyComplete={alreadyComplete}
        url={cfg.url ?? "#"}
        description={cfg.description}
      />
    );
  }
  if (node.type === "milestone") {
    const cfg = (node.config as { required_node_ids?: string[]; min_grade_percentage?: number }) ?? {};
    const required = (cfg.required_node_ids ?? []).filter(Boolean);
    let metCount = 0;
    if (required.length > 0) {
      const { data: grades } = await supabase
        .from("grades")
        .select("node_id, percentage, status")
        .eq("program_id", program.id)
        .eq("learner_id", session.user.id)
        .in("node_id", required)
        .in("status", ["graded", "completed"]);
      const min = cfg.min_grade_percentage ?? 0;
      metCount = (grades ?? []).filter((g) => Number(g.percentage ?? 0) >= min).length;
    }
    return (
      <MilestoneNodeView
        programId={program.id}
        nodeId={node.id}
        title={node.title}
        alreadyComplete={alreadyComplete}
        requiredCount={required.length}
        metCount={metCount}
      />
    );
  }
  if (node.type === "cert") {
    const { data: award } = await supabase
      .from("certificate_awards")
      .select("id, verification_code")
      .eq("program_id", program.id)
      .eq("learner_id", session.user.id)
      .order("awarded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (
      <CertNodeView
        programId={program.id}
        nodeId={node.id}
        title={node.title}
        alreadyComplete={alreadyComplete}
        hasAward={!!award}
        pdfUrl={award ? `/api/certificates/${award.id}/pdf?v=${award.verification_code}` : null}
        verificationCode={award?.verification_code ?? null}
      />
    );
  }
  if (node.type === "slides") {
    const cfg = (node.config as { slides?: { title: string; body: string; image_url?: string }[] }) ?? {};
    const { SlidesViewer } = await import("@/components/learn/slides-viewer");
    return (
      <SlidesViewer
        programId={program.id}
        nodeId={node.id}
        title={node.title}
        slides={cfg.slides ?? []}
        alreadyComplete={alreadyComplete}
      />
    );
  }

  // Read from the learner-safe view that excludes system_prompt + completion_criteria.
  const { data: bot } = await supabase
    .from("chatbot_learner_configs")
    .select("bot_name, avatar_initials, learner_instructions, model, token_budget, attempts_allowed")
    .eq("node_id", params.nodeId)
    .maybeSingle();

  // Ensure or resume an attempt.
  const start = await startConversation(params.programId, params.nodeId);
  if (!start.ok) {
    const isAttemptsExhausted = /all attempts used/i.test(start.error);
    return (
      <div className="cq-page" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: 16 }}>
          <Btn sm ghost asChild>
            <Link href={`/learn/${program.id}`}>
              <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> JOURNEY
            </Link>
          </Btn>
        </div>
        <Eyebrow>{isAttemptsExhausted ? "ATTEMPTS EXHAUSTED" : "CANNOT START"}</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
          {node.title.toUpperCase()}
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", lineHeight: 1.5 }}>
          {start.error}
          {isAttemptsExhausted ? (
            <>
              <br />
              Your previous attempt has been graded — you can review it below. If
              your instructor enables retry, the option will appear automatically.
            </>
          ) : null}
        </p>
        <div className="row" style={{ gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          {isAttemptsExhausted ? (
            <Btn asChild>
              <Link href={`/learn/${program.id}/${node.id}/grade`}>
                <Icon name="check" /> VIEW MY GRADE
              </Link>
            </Btn>
          ) : null}
          <Btn ghost asChild>
            <Link href={`/learn/${program.id}`}>BACK TO JOURNEY</Link>
          </Btn>
        </div>
      </div>
    );
  }

  // Pull existing messages so we can render history on first paint.
  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", start.conversationId)
    .order("created_at", { ascending: true });

  // Sibling nodes for the path rail — pull the full graph + run the
  // progress engine so locked / available / in-progress / completed states
  // match what the learner saw on the journey page.
  const [{ data: sibs }, { data: edges }, { data: rules }, { data: subs }] = await Promise.all([
    supabase
      .from("path_nodes")
      .select("id, title, type, display_order, available_at, due_at, is_required, points")
      .eq("program_id", params.programId)
      .order("display_order", { ascending: true }),
    supabase
      .from("path_edges")
      .select("source_node_id, target_node_id, condition")
      .eq("program_id", params.programId),
    supabase
      .from("node_rules")
      .select("node_id, rule_kind, config"),
    supabase
      .from("submissions")
      .select("node_id, attempt_number, conversation_id")
      .eq("program_id", params.programId)
      .eq("learner_id", session.user.id),
  ]);

  const subIds = (subs ?? []).map((s) => s.conversation_id);
  const { data: convStatuses } = await supabase
    .from("conversations")
    .select("id, node_id, status")
    .eq("program_id", params.programId)
    .eq("learner_id", session.user.id);
  const statusByConvId = new Map<string, string>();
  for (const c of convStatuses ?? []) statusByConvId.set(c.id, c.status);

  const { data: gradeRows } = await supabase
    .from("grades")
    .select("node_id, percentage, status")
    .eq("program_id", params.programId)
    .eq("learner_id", session.user.id);
  const gradeByNode = new Map<string, { pct: number | null; status: string }>();
  for (const g of gradeRows ?? []) {
    gradeByNode.set(g.node_id, {
      pct: g.percentage == null ? null : Number(g.percentage),
      status: g.status,
    });
  }

  const submissionsForEngine: SubmissionMin[] = (subs ?? []).map((s) => {
    const convStatus = subIds.includes(s.conversation_id)
      ? statusByConvId.get(s.conversation_id) ?? "in_progress"
      : "in_progress";
    const grade = gradeByNode.get(s.node_id);
    let status: SubmissionMin["status"] = "in_progress";
    if (grade?.status === "graded") status = "graded";
    else if (grade?.status === "needs_revision") status = "needs_revision";
    else if (convStatus === "submitted" || convStatus === "completed") status = "submitted";
    return {
      node_id: s.node_id,
      attempt_number: s.attempt_number,
      status,
      percentage: grade?.pct ?? null,
      delivery_status: null,
    };
  });

  const progress = computeProgress({
    nodes: ((sibs ?? []) as unknown) as PathNodeMin[],
    edges: ((edges ?? []) as unknown) as PathEdgeMin[],
    rules: ((rules ?? []) as unknown) as NodeRuleMin[],
    submissions: submissionsForEngine,
  });

  return (
    <ChatScreen
      programId={program.id}
      programTitle={program.title}
      nodeId={params.nodeId}
      conversationId={start.conversationId}
      attempt={start.attempt}
      bot={
        bot
          ? {
              name: bot.bot_name,
              avatar: bot.avatar_initials,
              instructions: bot.learner_instructions ?? "",
              model: bot.model,
              tokenBudget: bot.token_budget ?? 8000,
              attemptsAllowed: bot.attempts_allowed ?? 2,
            }
          : null
      }
      learnerName={session.user.displayName ?? session.user.fullName ?? session.user.email}
      initialMessages={(messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))}
      pathNodes={(sibs ?? []).map((n, i) => {
        const state = progress.get(n.id)?.state ?? "available";
        const status: "DONE" | "ACTIVE" | "AVAILABLE" | "LOCKED" =
          n.id === params.nodeId
            ? "ACTIVE"
            : state === "completed"
            ? "DONE"
            : state === "locked"
            ? "LOCKED"
            : "AVAILABLE";
        return {
          id: n.id,
          title: n.title,
          type: n.type as string,
          index: i + 1,
          status,
        };
      })}
    />
  );
}
