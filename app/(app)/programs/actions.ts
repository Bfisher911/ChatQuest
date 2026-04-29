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

  const objectKey = `${session.activeOrganizationId}/${parsed.data.programId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
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
