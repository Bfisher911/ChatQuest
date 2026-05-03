"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/auth/rbac";
import { getActiveRole } from "@/lib/auth/active-role";

// ─────────── Node CRUD (all types) ───────────

const baseNodeSchema = z.object({
  programId: z.string().uuid(),
  title: z.string().min(2),
  type: z.enum(["bot", "content", "pdf", "slides", "link", "milestone", "cert"]),
  config: z.record(z.unknown()).default({}),
  points: z.coerce.number().int().min(0).default(0),
  isRequired: z.coerce.boolean().default(true),
  availableAt: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  x: z.coerce.number().default(0),
  y: z.coerce.number().default(0),
});

export async function createNode(input: z.infer<typeof baseNodeSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const parsed = baseNodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("path_nodes")
    .select("display_order")
    .eq("program_id", parsed.data.programId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data: node, error } = await supabase
    .from("path_nodes")
    .insert({
      program_id: parsed.data.programId,
      type: parsed.data.type,
      title: parsed.data.title,
      display_order: nextOrder,
      points: parsed.data.points,
      is_required: parsed.data.isRequired,
      available_at: parsed.data.availableAt ?? null,
      due_at: parsed.data.dueAt ?? null,
      x: String(parsed.data.x),
      y: String(parsed.data.y),
      config: parsed.data.config,
    })
    .select("id")
    .single();
  if (error || !node) return { ok: false as const, error: error?.message ?? "Failed to create node" };

  // For bot nodes, auto-create a chatbot_configs row with defaults.
  if (parsed.data.type === "bot") {
    await supabase.from("chatbot_configs").insert({
      node_id: node.id,
      bot_name: parsed.data.title,
      avatar_initials: parsed.data.title
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      system_prompt: "You are a helpful tutor. Probe assumptions; demand citations from the program knowledge base.",
    });
  }

  revalidatePath(`/programs/${parsed.data.programId}`);
  revalidatePath(`/programs/${parsed.data.programId}/builder`);
  return { ok: true as const, nodeId: node.id };
}

const updateNodeSchema = z.object({
  nodeId: z.string().uuid(),
  programId: z.string().uuid(),
  title: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  points: z.coerce.number().int().min(0).optional(),
  isRequired: z.coerce.boolean().optional(),
  availableAt: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
});

export async function updateNode(input: z.infer<typeof updateNodeSchema>) {
  await requireSessionUser();
  const parsed = updateNodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.config !== undefined) update.config = parsed.data.config;
  if (parsed.data.points !== undefined) update.points = parsed.data.points;
  if (parsed.data.isRequired !== undefined) update.is_required = parsed.data.isRequired;
  if (parsed.data.availableAt !== undefined) update.available_at = parsed.data.availableAt;
  if (parsed.data.dueAt !== undefined) update.due_at = parsed.data.dueAt;
  if (parsed.data.x !== undefined) update.x = String(parsed.data.x);
  if (parsed.data.y !== undefined) update.y = String(parsed.data.y);

  const supabase = createClient();
  const { error } = await supabase.from("path_nodes").update(update).eq("id", parsed.data.nodeId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/programs/${parsed.data.programId}/builder`);
  return { ok: true as const };
}

export async function deleteNode(nodeId: string, programId: string) {
  await requireSessionUser();
  const supabase = createClient();
  const { error } = await supabase.from("path_nodes").delete().eq("id", nodeId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/programs/${programId}/builder`);
  return { ok: true as const };
}

// ─────────── Bot config inline editing (used by the builder inspector) ───────────

const updateBotConfigSchema = z.object({
  nodeId: z.string().uuid(),
  programId: z.string().uuid(),
  systemPrompt: z.string().min(1),
  learnerInstructions: z.string().optional().nullable(),
  model: z.string().min(1),
  temperature: z.coerce.number().min(0).max(2),
  tokenBudget: z.coerce.number().int().min(500),
  maxTokens: z.coerce.number().int().min(64),
  attemptsAllowed: z.coerce.number().int().min(1),
  rubricId: z.string().uuid().nullable().optional(),
  conversationGoal: z.string().optional().nullable(),
  completionCriteria: z.string().optional().nullable(),
  aiGradingEnabled: z.coerce.boolean().default(true),
  allowRetryAfterFeedback: z.coerce.boolean().default(true),
});

export async function updateBotConfig(input: z.infer<typeof updateBotConfigSchema>) {
  await requireSessionUser();
  const parsed = updateBotConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  // Upsert by node_id — covers the rare case where a bot node was created
  // outside the standard flow and has no chatbot_configs row yet.
  const { error } = await supabase
    .from("chatbot_configs")
    .upsert(
      {
        node_id: parsed.data.nodeId,
        system_prompt: parsed.data.systemPrompt,
        learner_instructions: parsed.data.learnerInstructions ?? null,
        model: parsed.data.model,
        temperature: String(parsed.data.temperature),
        token_budget: parsed.data.tokenBudget,
        max_tokens: parsed.data.maxTokens,
        attempts_allowed: parsed.data.attemptsAllowed,
        rubric_id: parsed.data.rubricId ?? null,
        conversation_goal: parsed.data.conversationGoal ?? null,
        completion_criteria: parsed.data.completionCriteria ?? null,
        ai_grading_enabled: parsed.data.aiGradingEnabled,
        allow_retry_after_feedback: parsed.data.allowRetryAfterFeedback,
      },
      { onConflict: "node_id" },
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/programs/${parsed.data.programId}/builder`);
  return { ok: true as const };
}

// ─────────── Chatrail publish / unpublish / archive ───────────

const setStatusSchema = z.object({
  programId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});

export async function setProgramStatus(input: z.infer<typeof setStatusSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can change Chatrail status." };
  }
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase
    .from("programs")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.programId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/programs/${parsed.data.programId}`);
  revalidatePath("/programs");
  revalidatePath("/learn");
  revalidatePath(`/learn/${parsed.data.programId}`);
  revalidatePath("/dashboard");
  return { ok: true as const, status: parsed.data.status };
}

// ─────────── Duplicate a single node within its Chatrail ───────────

/**
 * Clone a node within the same Chatrail. Useful for spinning up a variant of
 * a chatbot, content page, or PDF without retyping every field. Copies:
 *   - path_nodes row (offset position, "Copy of" title prefix, status fresh)
 *   - chatbot_configs row when type = bot (rebound to the new node id)
 *   - node_rules attached to the original (rebound; jsonb config's node_id /
 *     node_ids fields are NOT remapped — this is a single-node clone, not a
 *     full Chatrail clone).
 *
 * Edges, learner submissions, conversations, and grades are intentionally not
 * copied. The clone starts fresh.
 */
export async function duplicateNode(nodeId: string) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can duplicate nodes." };
  }
  const supabase = createClient();
  const { data: src } = await supabase
    .from("path_nodes")
    .select("id, program_id, type, title, x, y, points, is_required, config, available_at, due_at, until_at")
    .eq("id", nodeId)
    .maybeSingle();
  if (!src) return { ok: false as const, error: "Node not found" };

  // Determine the next display_order for this Chatrail.
  const { data: existing } = await supabase
    .from("path_nodes")
    .select("display_order")
    .eq("program_id", src.program_id)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  // Offset coordinates so the copy doesn't overlap on the canvas.
  const xNum = src.x == null ? 0 : Number(src.x);
  const yNum = src.y == null ? 0 : Number(src.y);
  const offsetX = isNaN(xNum) ? 40 : xNum + 40;
  const offsetY = isNaN(yNum) ? 40 : yNum + 40;

  const { data: cloned, error: nodeErr } = await supabase
    .from("path_nodes")
    .insert({
      program_id: src.program_id,
      type: src.type,
      title: `Copy of ${src.title}`,
      display_order: nextOrder,
      x: String(offsetX),
      y: String(offsetY),
      points: src.points,
      is_required: src.is_required,
      config: src.config,
      available_at: src.available_at,
      due_at: src.due_at,
      until_at: src.until_at,
    })
    .select("id")
    .single();
  if (nodeErr || !cloned) return { ok: false as const, error: nodeErr?.message ?? "Failed to clone node" };

  // Clone chatbot_configs for bot nodes.
  if (src.type === "bot") {
    const admin = createServiceRoleClient();
    const { data: cfg } = await admin
      .from("chatbot_configs")
      .select(
        "bot_name, avatar_initials, learner_instructions, system_prompt, conversation_goal, completion_criteria, model, temperature, max_tokens, token_budget, attempts_allowed, end_after_turns, end_when_objective_met, require_submit_button, produce_completion_summary, ask_reflection_questions, allow_retry_after_feedback, rubric_id, ai_grading_enabled, use_program_kb, node_kb_id",
      )
      .eq("node_id", nodeId)
      .maybeSingle();
    if (cfg) {
      await admin.from("chatbot_configs").insert({ ...cfg, node_id: cloned.id });
    }
  }

  // Clone node_rules attached to the source node.
  const { data: rules } = await supabase
    .from("node_rules")
    .select("rule_kind, config")
    .eq("node_id", nodeId);
  if (rules && rules.length > 0) {
    await supabase
      .from("node_rules")
      .insert(rules.map((r) => ({ node_id: cloned.id, rule_kind: r.rule_kind, config: r.config })));
  }

  revalidatePath(`/programs/${src.program_id}/builder`);
  revalidatePath(`/programs/${src.program_id}`);
  return { ok: true as const, nodeId: cloned.id };
}

// ─────────── Edge CRUD ───────────

const edgeSchema = z.object({
  programId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  condition: z.record(z.unknown()).optional().nullable(),
});

export async function createEdge(input: z.infer<typeof edgeSchema>) {
  await requireSessionUser();
  const parsed = edgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase.from("path_edges").insert({
    program_id: parsed.data.programId,
    source_node_id: parsed.data.sourceNodeId,
    target_node_id: parsed.data.targetNodeId,
    condition: parsed.data.condition ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/programs/${parsed.data.programId}/builder`);
  return { ok: true as const };
}

export async function deleteEdge(programId: string, sourceNodeId: string, targetNodeId: string) {
  await requireSessionUser();
  const supabase = createClient();
  const { error } = await supabase
    .from("path_edges")
    .delete()
    .eq("program_id", programId)
    .eq("source_node_id", sourceNodeId)
    .eq("target_node_id", targetNodeId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/programs/${programId}/builder`);
  return { ok: true as const };
}

// ─────────── Learner: mark non-bot node complete ───────────

/**
 * Marks a non-bot node complete for the current learner. For content / pdf /
 * slides / link nodes that don't have a graded conversation, we just create
 * an instant "submitted + graded" record so the progress engine sees them as
 * completed and downstream nodes unlock.
 */
export async function markNodeComplete(programId: string, nodeId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const admin = createServiceRoleClient();
  const { data: node } = await admin
    .from("path_nodes")
    .select("id, type, points, organization_id:program_id")
    .eq("id", nodeId)
    .single();
  if (!node) return { ok: false as const, error: "Node not found" };

  const { data: program } = await admin
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .single();
  if (!program) return { ok: false as const, error: "Program not found" };

  // Idempotent: bail if a submission already exists.
  const { data: existing } = await admin
    .from("submissions")
    .select("id")
    .eq("program_id", programId)
    .eq("node_id", nodeId)
    .eq("learner_id", session.user.id)
    .maybeSingle();
  if (existing) {
    return { ok: true as const, alreadyComplete: true };
  }

  // Need a stub conversation row for FK integrity.
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({
      program_id: programId,
      node_id: nodeId,
      learner_id: session.user.id,
      organization_id: program.organization_id,
      attempt_number: 1,
      status: "completed",
      submitted_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (convErr || !conv) return { ok: false as const, error: convErr?.message ?? "Failed to mark complete" };

  const { data: sub, error: subErr } = await admin
    .from("submissions")
    .insert({
      conversation_id: conv.id,
      program_id: programId,
      node_id: nodeId,
      learner_id: session.user.id,
      organization_id: program.organization_id,
      attempt_number: 1,
      delivery_status: "on_time",
    })
    .select("id")
    .single();
  if (subErr || !sub) return { ok: false as const, error: subErr?.message ?? "Submission insert failed" };

  // Auto-grade at full points so the progress engine sees `completed` + percentage = 100.
  const points = node.points ?? 0;
  await admin.from("grades").insert({
    submission_id: sub.id,
    conversation_id: conv.id,
    program_id: programId,
    node_id: nodeId,
    learner_id: session.user.id,
    organization_id: program.organization_id,
    status: "graded",
    score: points,
    max_score: points,
    percentage: 100,
    graded_at: new Date().toISOString(),
  });

  // Maybe award a certificate now that progress changed.
  await maybeAwardCertificates(programId, session.user.id, program.organization_id);

  revalidatePath(`/learn/${programId}`);
  return { ok: true as const };
}

// ─────────── Auto-award certificates when eligible ───────────

export async function maybeAwardCertificates(
  programId: string,
  learnerId: string,
  organizationId: string,
): Promise<{ awarded: string[] }> {
  const admin = createServiceRoleClient();

  // All certificate definitions in the program.
  const { data: certs } = await admin
    .from("certificates")
    .select("id, title, required_node_ids, min_grade_percentage, requires_instructor_approval, template_id")
    .eq("program_id", programId);
  if (!certs || certs.length === 0) return { awarded: [] };

  // Already-granted certs for this learner.
  const { data: existing } = await admin
    .from("certificate_awards")
    .select("certificate_id")
    .eq("program_id", programId)
    .eq("learner_id", learnerId);
  const granted = new Set((existing ?? []).map((e) => e.certificate_id));

  // Learner's grades for the program.
  const { data: grades } = await admin
    .from("grades")
    .select("node_id, percentage, status")
    .eq("program_id", programId)
    .eq("learner_id", learnerId)
    .in("status", ["graded", "completed"]);
  const gradesByNode = new Map<string, number | null>();
  for (const g of grades ?? []) {
    const pct = g.percentage == null ? null : Number(g.percentage);
    gradesByNode.set(g.node_id, pct);
  }

  const awarded: string[] = [];
  for (const cert of certs) {
    if (granted.has(cert.id)) continue;
    if (cert.requires_instructor_approval) continue; // wait for instructor.

    const required = ((cert.required_node_ids as string[] | null) ?? []) as string[];
    const min = cert.min_grade_percentage == null ? 0 : Number(cert.min_grade_percentage);
    const allMet = required.every((id) => {
      const pct = gradesByNode.get(id);
      return pct !== undefined && (pct ?? 0) >= min;
    });
    if (!allMet) continue;

    const { data: award } = await admin
      .from("certificate_awards")
      .insert({
        certificate_id: cert.id,
        program_id: programId,
        learner_id: learnerId,
        organization_id: organizationId,
      })
      .select("id, verification_code")
      .single();
    if (award) {
      awarded.push(award.id);
      // Fire learner notification (Phase T).
      const { createNotification } = await import("@/lib/notifications/create");
      await createNotification({
        userId: learnerId,
        organizationId,
        kind: "cert_awarded",
        title: `Certificate awarded: ${cert.title}`,
        body: "Open it to download the PDF or share the verification link.",
        href: "/learn/certificates",
        metadata: {
          certificate_id: cert.id,
          award_id: award.id,
          verification_code: award.verification_code,
        },
      });
    }
  }

  return { awarded };
}
