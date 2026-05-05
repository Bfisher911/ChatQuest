"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/auth/rbac";
import { getActiveRole } from "@/lib/auth/active-role";
import { indexKnowledgeFile } from "@/lib/rag/index-file";

const createProgramSchema = z.object({
  title: z.string().min(2, "Title required"),
  description: z.string().optional(),
  defaultModel: z.string().optional(),
});

export async function createProgram(formData: FormData) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) {
    return { ok: false as const, error: "Sign in as an instructor first." };
  }
  const parsed = createProgramSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    defaultModel: formData.get("defaultModel") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Plan-feature gate (Phase D).
  const { canCreateProgram } = await import("@/lib/billing/gate");
  const gate = await canCreateProgram(session.activeOrganizationId);
  if (!gate.ok) return { ok: false as const, error: gate.reason };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      organization_id: session.activeOrganizationId,
      created_by: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      default_model: parsed.data.defaultModel ?? "claude-haiku-4-5",
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Failed to create program" };

  // Add the creator as the owning instructor.
  await supabase.from("program_instructors").insert({
    program_id: data.id,
    user_id: session.user.id,
    capacity: "owner",
  });

  // Provision a default program-level knowledge collection.
  await supabase.from("knowledge_collections").insert({
    organization_id: session.activeOrganizationId,
    program_id: data.id,
    name: "Program Knowledge Base",
  });

  revalidatePath("/dashboard");
  revalidatePath("/programs");
  redirect(`/programs/${data.id}`);
}

const updateProgramSchema = z.object({
  programId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  defaultModel: z.string(),
  passingThreshold: z.coerce.number().min(0).max(100),
  monthlyTokenBudget: z.coerce.number().int().nonnegative(),
  shareConversationsWithOrgAdmin: z.coerce.boolean(),
});

export async function updateProgram(formData: FormData) {
  await requireSessionUser();
  const parsed = updateProgramSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status"),
    defaultModel: formData.get("defaultModel"),
    passingThreshold: formData.get("passingThreshold"),
    monthlyTokenBudget: formData.get("monthlyTokenBudget"),
    shareConversationsWithOrgAdmin: formData.get("shareConversationsWithOrgAdmin") === "on",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase
    .from("programs")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      default_model: parsed.data.defaultModel,
      passing_threshold: parsed.data.passingThreshold,
      monthly_token_budget: parsed.data.monthlyTokenBudget,
      share_conversations_with_org_admin: parsed.data.shareConversationsWithOrgAdmin,
    })
    .eq("id", parsed.data.programId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/programs/${parsed.data.programId}`);
  return { ok: true as const };
}

const createBotNodeSchema = z.object({
  programId: z.string().uuid(),
  title: z.string().min(2),
  systemPrompt: z.string().min(10),
  learnerInstructions: z.string().optional(),
  model: z.string().default("claude-haiku-4-5"),
  temperature: z.coerce.number().min(0).max(1).default(0.4),
  tokenBudget: z.coerce.number().int().min(500).default(8000),
  maxTokens: z.coerce.number().int().min(64).default(1024),
  attemptsAllowed: z.coerce.number().int().min(1).default(2),
  points: z.coerce.number().int().min(0).default(25),
  rubricId: z.string().uuid().optional().nullable(),
  // Whether the bot pulls top-k chunks from the program KB on each turn.
  // Default true matches the DB column default.
  useProgramKb: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === true || v === "on" || v === "true")
    .default(true as unknown as boolean),
  // Whether submit triggers an AI summary + suggested rubric score. Off
  // for bots where AI scoring is inappropriate (e.g. raw-prompt practice).
  aiGradingEnabled: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === true || v === "on" || v === "true")
    .default(true as unknown as boolean),
});

export async function createBotNode(formData: FormData) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const parsed = createBotNodeSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    systemPrompt: formData.get("systemPrompt"),
    learnerInstructions: formData.get("learnerInstructions") || undefined,
    model: formData.get("model") ?? undefined,
    temperature: formData.get("temperature") ?? undefined,
    tokenBudget: formData.get("tokenBudget") ?? undefined,
    maxTokens: formData.get("maxTokens") ?? undefined,
    attemptsAllowed: formData.get("attemptsAllowed") ?? undefined,
    points: formData.get("points") ?? undefined,
    rubricId: formData.get("rubricId") || null,
    useProgramKb: formData.get("useProgramKb") ?? undefined,
    aiGradingEnabled: formData.get("aiGradingEnabled") ?? undefined,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  // Determine display order = max(existing) + 1.
  const { data: existing } = await supabase
    .from("path_nodes")
    .select("display_order")
    .eq("program_id", parsed.data.programId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data: node, error: nodeErr } = await supabase
    .from("path_nodes")
    .insert({
      program_id: parsed.data.programId,
      type: "bot",
      title: parsed.data.title,
      display_order: nextOrder,
      points: parsed.data.points,
    })
    .select("id")
    .single();
  if (nodeErr || !node) return { ok: false as const, error: nodeErr?.message ?? "Failed to create node" };

  const { error: cfgErr } = await supabase.from("chatbot_configs").insert({
    node_id: node.id,
    bot_name: parsed.data.title,
    avatar_initials: parsed.data.title
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    system_prompt: parsed.data.systemPrompt,
    learner_instructions: parsed.data.learnerInstructions,
    model: parsed.data.model,
    temperature: String(parsed.data.temperature),
    token_budget: parsed.data.tokenBudget,
    max_tokens: parsed.data.maxTokens,
    attempts_allowed: parsed.data.attemptsAllowed,
    rubric_id: parsed.data.rubricId || null,
    use_program_kb: parsed.data.useProgramKb,
    ai_grading_enabled: parsed.data.aiGradingEnabled,
  });
  if (cfgErr) return { ok: false as const, error: cfgErr.message };

  revalidatePath(`/programs/${parsed.data.programId}`);
  redirect(`/programs/${parsed.data.programId}/nodes/${node.id}`);
}

const updateBotNodeSchema = createBotNodeSchema.extend({
  nodeId: z.string().uuid(),
});

export async function updateBotNode(formData: FormData) {
  await requireSessionUser();
  const parsed = updateBotNodeSchema.safeParse({
    nodeId: formData.get("nodeId"),
    programId: formData.get("programId"),
    title: formData.get("title"),
    systemPrompt: formData.get("systemPrompt"),
    learnerInstructions: formData.get("learnerInstructions") || undefined,
    model: formData.get("model") ?? undefined,
    temperature: formData.get("temperature") ?? undefined,
    tokenBudget: formData.get("tokenBudget") ?? undefined,
    maxTokens: formData.get("maxTokens") ?? undefined,
    attemptsAllowed: formData.get("attemptsAllowed") ?? undefined,
    points: formData.get("points") ?? undefined,
    rubricId: formData.get("rubricId") || null,
    useProgramKb: formData.get("useProgramKb") ?? undefined,
    aiGradingEnabled: formData.get("aiGradingEnabled") ?? undefined,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  const { error: nodeErr } = await supabase
    .from("path_nodes")
    .update({ title: parsed.data.title, points: parsed.data.points })
    .eq("id", parsed.data.nodeId);
  if (nodeErr) return { ok: false as const, error: nodeErr.message };

  const { error: cfgErr } = await supabase
    .from("chatbot_configs")
    .update({
      bot_name: parsed.data.title,
      system_prompt: parsed.data.systemPrompt,
      learner_instructions: parsed.data.learnerInstructions,
      model: parsed.data.model,
      temperature: String(parsed.data.temperature),
      token_budget: parsed.data.tokenBudget,
      max_tokens: parsed.data.maxTokens,
      attempts_allowed: parsed.data.attemptsAllowed,
      rubric_id: parsed.data.rubricId || null,
      use_program_kb: parsed.data.useProgramKb,
      ai_grading_enabled: parsed.data.aiGradingEnabled,
    })
    .eq("node_id", parsed.data.nodeId);
  if (cfgErr) return { ok: false as const, error: cfgErr.message };

  revalidatePath(`/programs/${parsed.data.programId}`);
  revalidatePath(`/programs/${parsed.data.programId}/nodes/${parsed.data.nodeId}`);
  return { ok: true as const };
}

const uploadKbFileSchema = z.object({
  collectionId: z.string().uuid(),
  programId: z.string().uuid(),
});

const KB_BUCKET = "kb-files";

export async function uploadKbFile(formData: FormData) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };

  const parsed = uploadKbFileSchema.safeParse({
    collectionId: formData.get("collectionId"),
    programId: formData.get("programId"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Pick a file first." };
  }

  // Phase A.6 — file upload validation.
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MiB hard cap (matches Storage policy).
  if (file.size > MAX_BYTES) {
    return { ok: false as const, error: "File is over 20 MB." };
  }
  const safeName = file.name;
  if (safeName.includes(" ") || safeName.includes("..") || safeName.length > 255) {
    return { ok: false as const, error: "Filename has unsafe characters." };
  }
  const ALLOWED_EXT = [".pdf", ".txt", ".md", ".markdown", ".csv", ".docx"];
  if (!ALLOWED_EXT.some((ext) => safeName.toLowerCase().endsWith(ext))) {
    return {
      ok: false as const,
      error: "Unsupported file type. Use PDF, TXT, MD, CSV, or DOCX.",
    };
  }
  // MIME sniff: read the first 8 bytes and verify they match the claimed type.
  const sniffBuf = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const looksLikePdf = sniffBuf[0] === 0x25 && sniffBuf[1] === 0x50 && sniffBuf[2] === 0x44 && sniffBuf[3] === 0x46; // %PDF
  const looksLikeZip = sniffBuf[0] === 0x50 && sniffBuf[1] === 0x4b; // PK (DOCX/zip)
  if (safeName.toLowerCase().endsWith(".pdf") && !looksLikePdf) {
    return { ok: false as const, error: "File extension is .pdf but the content isn't a PDF." };
  }
  if (safeName.toLowerCase().endsWith(".docx") && !looksLikeZip) {
    return { ok: false as const, error: "File extension is .docx but the content isn't a DOCX." };
  }

  const admin = createServiceRoleClient();
  // Make sure the bucket exists. Idempotent via getBucket.
  try {
    const { error: bucketErr } = await admin.storage.getBucket(KB_BUCKET);
    if (bucketErr) {
      await admin.storage.createBucket(KB_BUCKET, { public: false });
    }
  } catch {
    // Likely the bucket already exists; ignore.
  }

  const objectKey = `${session.activeOrganizationId}/${parsed.data.programId}/${Date.now()}-${safeName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuf = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from(KB_BUCKET)
    .upload(objectKey, Buffer.from(arrayBuf), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return { ok: false as const, error: uploadErr.message };

  const { data: row, error: insertErr } = await admin
    .from("knowledge_files")
    .insert({
      collection_id: parsed.data.collectionId,
      organization_id: session.activeOrganizationId,
      filename: file.name,
      storage_path: objectKey,
      mime_type: file.type || null,
      bytes: file.size,
      uploaded_by: session.user.id,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !row) return { ok: false as const, error: insertErr?.message ?? "Insert failed" };

  // Index synchronously for Phase 1. (Phase 4 = background queue.)
  const result = await indexKnowledgeFile(row.id, session.activeOrganizationId, session.user.id);

  revalidatePath(`/programs/${parsed.data.programId}/kb`);
  revalidatePath(`/programs/${parsed.data.programId}`);
  return { ok: result.status === "indexed", error: result.error, fileId: row.id, chunks: result.chunks };
}

// ─────────── Duplicate a Chatrail ───────────

/**
 * Clone a Chatrail and everything that defines its shape — nodes, edges,
 * chatbot configs, node rules, certificates (rebound to the new node ids),
 * and a fresh program-level knowledge collection.
 *
 * Intentionally NOT cloned: enrollments, conversations, submissions, grades,
 * cert awards, KB files. The duplicate starts as a clean draft.
 */
export async function duplicateProgram(programId: string) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can duplicate Chatrails." };
  }
  const admin = createServiceRoleClient();

  // 1. Source program (must be in caller's org).
  const { data: src } = await admin
    .from("programs")
    .select(
      "id, organization_id, title, description, cover_image_url, default_model, monthly_token_budget, passing_threshold, share_conversations_with_org_admin, learner_pays, learner_price_cents",
    )
    .eq("id", programId)
    .maybeSingle();
  if (!src) return { ok: false as const, error: "Chatrail not found" };
  if (src.organization_id !== session.activeOrganizationId && !session.user.isSuperAdmin) {
    return { ok: false as const, error: "Cross-org duplication refused." };
  }

  // 2. Insert new program row as a draft.
  const { data: newProgram, error: progErr } = await admin
    .from("programs")
    .insert({
      organization_id: src.organization_id,
      created_by: session.user.id,
      title: `Copy of ${src.title}`,
      description: src.description,
      cover_image_url: src.cover_image_url,
      status: "draft",
      enrollment_type: "invite_only",
      default_model: src.default_model,
      monthly_token_budget: src.monthly_token_budget,
      passing_threshold: src.passing_threshold,
      share_conversations_with_org_admin: src.share_conversations_with_org_admin,
      learner_pays: src.learner_pays,
      learner_price_cents: src.learner_price_cents,
    })
    .select("id")
    .single();
  if (progErr || !newProgram) return { ok: false as const, error: progErr?.message ?? "Failed to create copy." };

  // 2a. Add caller as program owner.
  await admin.from("program_instructors").insert({
    program_id: newProgram.id,
    user_id: session.user.id,
    capacity: "owner",
  });

  // 3. Clone nodes (build old_id → new_id mapping).
  const { data: srcNodes } = await admin
    .from("path_nodes")
    .select("id, type, title, display_order, x, y, points, is_required, config, available_at, due_at, until_at")
    .eq("program_id", programId)
    .order("display_order", { ascending: true });
  const nodeIdMap = new Map<string, string>();
  for (const n of srcNodes ?? []) {
    const { data: inserted, error: nodeErr } = await admin
      .from("path_nodes")
      .insert({
        program_id: newProgram.id,
        type: n.type,
        title: n.title,
        display_order: n.display_order,
        x: n.x,
        y: n.y,
        points: n.points,
        is_required: n.is_required,
        config: n.config,
        available_at: n.available_at,
        due_at: n.due_at,
        until_at: n.until_at,
      })
      .select("id")
      .single();
    if (nodeErr || !inserted) {
      // Best-effort cleanup so we don't leave a half-baked program around.
      await admin.from("programs").delete().eq("id", newProgram.id);
      return { ok: false as const, error: nodeErr?.message ?? "Failed to clone a node." };
    }
    nodeIdMap.set(n.id, inserted.id);
  }

  // 4. Clone chatbot_configs for every bot node.
  const botNodeIds = (srcNodes ?? []).filter((n) => n.type === "bot").map((n) => n.id);
  if (botNodeIds.length > 0) {
    const { data: configs } = await admin
      .from("chatbot_configs")
      .select(
        "node_id, bot_name, avatar_initials, learner_instructions, system_prompt, conversation_goal, completion_criteria, model, temperature, max_tokens, token_budget, attempts_allowed, end_after_turns, end_when_objective_met, require_submit_button, produce_completion_summary, ask_reflection_questions, allow_retry_after_feedback, rubric_id, ai_grading_enabled, use_program_kb, node_kb_id",
      )
      .in("node_id", botNodeIds);
    const cfgRows = (configs ?? [])
      .map((c) => {
        const newNodeId = nodeIdMap.get(c.node_id);
        if (!newNodeId) return null;
        const { node_id: _drop, ...rest } = c as { node_id: string } & Record<string, unknown>;
        void _drop;
        return { ...rest, node_id: newNodeId };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (cfgRows.length > 0) {
      await admin.from("chatbot_configs").insert(cfgRows);
    }
  }

  // 5. Clone path_edges (rebind source + target to new node ids).
  const { data: srcEdges } = await admin
    .from("path_edges")
    .select("source_node_id, target_node_id, condition")
    .eq("program_id", programId);
  const edgeRows = (srcEdges ?? [])
    .map((e) => {
      const newSrc = nodeIdMap.get(e.source_node_id);
      const newTgt = nodeIdMap.get(e.target_node_id);
      if (!newSrc || !newTgt) return null;
      return {
        program_id: newProgram.id,
        source_node_id: newSrc,
        target_node_id: newTgt,
        condition: e.condition,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);
  if (edgeRows.length > 0) {
    await admin.from("path_edges").insert(edgeRows);
  }

  // 6. Clone node_rules (config jsonb may reference old node ids — best effort
  //    rebind for the common shapes we know about).
  if (srcNodes && srcNodes.length > 0) {
    const { data: srcRules } = await admin
      .from("node_rules")
      .select("node_id, rule_kind, config")
      .in("node_id", srcNodes.map((n) => n.id));
    const ruleRows = (srcRules ?? [])
      .map((r) => {
        const newNodeId = nodeIdMap.get(r.node_id);
        if (!newNodeId) return null;
        const cfg = r.config as Record<string, unknown> | null;
        let rebound: Record<string, unknown> = cfg ?? {};
        if (cfg) {
          if (typeof cfg.node_id === "string") {
            const m = nodeIdMap.get(cfg.node_id);
            if (m) rebound = { ...rebound, node_id: m };
          }
          if (Array.isArray(cfg.node_ids)) {
            rebound = {
              ...rebound,
              node_ids: (cfg.node_ids as string[]).map((id) => nodeIdMap.get(id) ?? id),
            };
          }
        }
        return { node_id: newNodeId, rule_kind: r.rule_kind, config: rebound };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (ruleRows.length > 0) {
      await admin.from("node_rules").insert(ruleRows);
    }
  }

  // 7. Clone certificates (rebind required_node_ids to new ids; reuse template).
  const { data: srcCerts } = await admin
    .from("certificates")
    .select("title, node_id, template_id, required_node_ids, min_grade_percentage, requires_instructor_approval")
    .eq("program_id", programId);
  const certRows = (srcCerts ?? []).map((c) => ({
    program_id: newProgram.id,
    node_id: c.node_id ? nodeIdMap.get(c.node_id) ?? null : null,
    template_id: c.template_id,
    title: c.title,
    required_node_ids: ((c.required_node_ids as string[] | null) ?? []).map(
      (id) => nodeIdMap.get(id) ?? id,
    ),
    min_grade_percentage: c.min_grade_percentage,
    requires_instructor_approval: c.requires_instructor_approval,
  }));
  if (certRows.length > 0) {
    await admin.from("certificates").insert(certRows);
  }

  // 8. Provision a fresh program-level KB collection (empty — files don't copy).
  await admin.from("knowledge_collections").insert({
    organization_id: src.organization_id,
    program_id: newProgram.id,
    name: "Program Knowledge Base",
    created_by: session.user.id,
  });

  revalidatePath("/programs");
  revalidatePath("/dashboard");
  return { ok: true as const, programId: newProgram.id };
}

export async function reindexKbFile(fileId: string) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const result = await indexKnowledgeFile(fileId, session.activeOrganizationId, session.user.id);
  revalidatePath("/programs", "layout");
  return { ok: result.status === "indexed", error: result.error };
}

export async function deleteKbFile(fileId: string, programId: string) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const admin = createServiceRoleClient();
  const { data: file } = await admin
    .from("knowledge_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();
  if (file?.storage_path) {
    await admin.storage.from(KB_BUCKET).remove([file.storage_path]);
  }
  await admin.from("knowledge_files").delete().eq("id", fileId);
  revalidatePath(`/programs/${programId}/kb`);
  return { ok: true as const };
}

// ─────────── Permanent Chatrail deletion ───────────
//
// Hard-delete with title-typed confirmation gate. Foreign keys cascade to
// path nodes / edges / rules / chatbot_configs / KB collections + files /
// conversations / messages / submissions / grades / cert awards / enrollments
// / instructors / invites / billing rows. Rubrics survive (FK is
// ON DELETE SET NULL) since they're org-level and reusable.
//
// We pre-fetch storage paths for KB files + PDF node files and remove the
// blobs from buckets BEFORE the DB cascade — otherwise we'd leak storage.
export async function deleteProgram(input: { programId: string; confirmTitle: string }) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can delete Chatrails." };
  }
  const admin = createServiceRoleClient();

  const { data: program } = await admin
    .from("programs")
    .select("id, organization_id, title")
    .eq("id", input.programId)
    .maybeSingle();
  if (!program) return { ok: false as const, error: "Chatrail not found" };
  if (program.organization_id !== session.activeOrganizationId && !session.user.isSuperAdmin) {
    return { ok: false as const, error: "Cross-org deletion refused." };
  }

  // Title-typed confirmation must match exactly (case-sensitive). This is the
  // last guard between an accidental click and permanent data loss.
  if ((input.confirmTitle ?? "").trim() !== program.title.trim()) {
    return {
      ok: false as const,
      error: "Confirmation text doesn't match the Chatrail title.",
    };
  }

  // ─── Storage cleanup: KB files (kb-files bucket) + PDF node files (node-files bucket) ───
  // Done before the DB cascade so we still have the storage_path values.
  const { data: kbCollections } = await admin
    .from("knowledge_collections")
    .select("id")
    .eq("program_id", program.id);
  const collectionIds = (kbCollections ?? []).map((c) => c.id);
  if (collectionIds.length) {
    const { data: kbFiles } = await admin
      .from("knowledge_files")
      .select("storage_path")
      .in("collection_id", collectionIds);
    const kbPaths = (kbFiles ?? []).map((f) => f.storage_path).filter(Boolean) as string[];
    if (kbPaths.length) {
      const { error: kbErr } = await admin.storage.from(KB_BUCKET).remove(kbPaths);
      if (kbErr) console.error("[delete-chatrail] kb storage cleanup:", kbErr.message);
    }
  }

  const { data: pdfNodes } = await admin
    .from("path_nodes")
    .select("config")
    .eq("program_id", program.id)
    .eq("type", "pdf");
  const pdfPaths: string[] = [];
  for (const n of pdfNodes ?? []) {
    const cfg = (n.config as { storage_path?: string }) ?? {};
    if (cfg.storage_path) pdfPaths.push(cfg.storage_path);
  }
  if (pdfPaths.length) {
    const { error: pdfErr } = await admin.storage.from("node-files").remove(pdfPaths);
    if (pdfErr) console.error("[delete-chatrail] node-files cleanup:", pdfErr.message);
  }

  // ─── Drop the program row; FK cascades clear everything else ───
  const { error: delErr } = await admin.from("programs").delete().eq("id", program.id);
  if (delErr) return { ok: false as const, error: delErr.message };

  // Audit trail.
  await admin.from("audit_logs").insert({
    organization_id: program.organization_id,
    actor_user_id: session.user.id,
    action: "program.deleted",
    target_type: "program",
    target_id: program.id,
    metadata: { title: program.title },
  });

  revalidatePath("/dashboard");
  revalidatePath("/programs");
  return { ok: true as const };
}
