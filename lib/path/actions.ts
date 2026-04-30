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
    if (award) awarded.push(award.id);
    // Email send is wired in the cert PDF route once the file is materialized.
  }

  return { awarded };
}
