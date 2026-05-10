"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { generateChatrailPlan, type GeneratedNode } from "@/lib/llm/generate-chatrail";
import { logUsage } from "@/lib/llm/usage";

const generateSchema = z.object({
  prompt: z.string().min(20, "Describe the Chatrail in at least 20 characters.").max(4000),
  // Gemini-only deployment. Restricted to current 3.x family + auto-tracking
  // aliases + 2.5 fallbacks. Default = gemini-3-flash-preview (fast + cheap +
  // current canonical name).
  model: z
    .enum([
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-flash-lite-latest",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ])
    .default("gemini-3-flash-preview"),
});

export type GenerateChatrailResult =
  | { ok: true; programId: string; nodeCount: number; inputTokens: number; outputTokens: number }
  | { ok: false; error: string };

/**
 * Generate a Chatrail end-to-end from a natural-language prompt.
 *
 * 1) Calls the LLM helper to produce a validated plan
 * 2) Inserts the program (status="draft"), provisions the KB collection
 * 3) Inserts each node + chatbot_config in display order
 * 4) Inserts a linear chain of path_edges connecting them in sequence
 * 5) Logs token usage so the cost shows up in /org/billing
 *
 * On any DB failure after the program row is created, we DO NOT roll back —
 * the program is left in draft so the creator can fix it manually rather
 * than losing the LLM-generated content. They can always delete it from the
 * DANGER ZONE if they don't want it.
 */
export async function generateChatrailFromPrompt(input: z.infer<typeof generateSchema>): Promise<GenerateChatrailResult> {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false, error: "Sign in as a Creator first." };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false, error: "Only Creators can generate Chatrails." };
  }

  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Plan-feature seat enforcement (matches createProgram).
  const { canCreateProgram } = await import("@/lib/billing/gate");
  const gate = await canCreateProgram(session.activeOrganizationId);
  if (!gate.ok) return { ok: false, error: gate.reason };

  // 1) Generate the plan.
  let plan;
  let inputTokens = 0;
  let outputTokens = 0;
  let modelUsed: string = parsed.data.model;
  try {
    const result = await generateChatrailPlan({ prompt: parsed.data.prompt, model: parsed.data.model });
    plan = result.plan;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    modelUsed = result.modelUsed;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const { friendlyLLMError } = await import("@/lib/llm/errors");
    console.error("[generate-chatrail] LLM call failed:", err);
    return { ok: false, error: friendlyLLMError(raw) };
  }

  const admin = createServiceRoleClient();

  // 2) Create the program (status=draft so creators can review before publish).
  const { data: program, error: progErr } = await admin
    .from("programs")
    .insert({
      organization_id: session.activeOrganizationId,
      created_by: session.user.id,
      title: plan.title,
      description: plan.description,
      default_model: plan.defaultModel,
      status: "draft",
    })
    .select("id")
    .single();
  if (progErr || !program) {
    return { ok: false, error: progErr?.message ?? "Failed to create program row" };
  }

  // Owning instructor.
  await admin.from("program_instructors").insert({
    program_id: program.id,
    user_id: session.user.id,
    capacity: "owner",
  });

  // Default KB collection. Even all-bot Chatrails benefit from having one
  // ready so creators can drop reference docs in.
  await admin.from("knowledge_collections").insert({
    organization_id: session.activeOrganizationId,
    program_id: program.id,
    name: "Program Knowledge Base",
  });

  // 3) Insert nodes in order. Capture the IDs so we can build edges next.
  const insertedNodeIds: string[] = [];
  for (let i = 0; i < plan.nodes.length; i++) {
    const n: GeneratedNode = plan.nodes[i];
    const config: Record<string, unknown> = {};
    if (n.type === "content" && n.bodyMarkdown) {
      // The content-node renderer reads body_html — we store the raw markdown
      // wrapped so it renders as a paragraph. Creators can swap to TipTap-
      // authored HTML later in the inspector.
      const escaped = n.bodyMarkdown
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      config.body_html = `<div style="white-space: pre-wrap;">${escaped}</div>`;
    }

    const { data: node, error: nodeErr } = await admin
      .from("path_nodes")
      .insert({
        program_id: program.id,
        type: n.type,
        title: n.title,
        display_order: i,
        points: n.points,
        is_required: true,
        // path_nodes.config is `not null default '{}'::jsonb`. Postgres
        // only applies the default when the column is OMITTED from the
        // INSERT — explicitly passing null violates the NOT NULL
        // constraint. Always pass at least an empty object.
        config,
      })
      .select("id")
      .single();
    if (nodeErr || !node) {
      // First node failed — roll back the empty program row so it doesn't
      // count against the user's plan-feature cap (free plan = 1 active
      // program, and an orphan empty draft eats that slot until manually
      // deleted). FK cascade clears program_instructors + knowledge
      // collections we just created. If we got past the first node then
      // we leave the partial in place so the creator can salvage it.
      if (insertedNodeIds.length === 0) {
        await admin.from("programs").delete().eq("id", program.id);
        return {
          ok: false,
          error: `Generation failed before any nodes could be saved (${nodeErr?.message ?? "unknown error"}). The empty draft has been cleaned up — try generating again.`,
        };
      }
      return {
        ok: false,
        error: `Inserted ${insertedNodeIds.length}/${plan.nodes.length} nodes before failing: ${nodeErr?.message ?? "unknown error"}. The Chatrail is in draft — you can keep editing or delete it.`,
      };
    }
    insertedNodeIds.push(node.id);

    // Bot config for type="bot" nodes.
    if (n.type === "bot") {
      const initials = n.title
        .split(/\s+/)
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase() || "AI";
      await admin.from("chatbot_configs").insert({
        node_id: node.id,
        bot_name: n.title,
        avatar_initials: initials,
        system_prompt: n.systemPrompt ?? "You are a helpful tutor. Stay in role.",
        learner_instructions: n.learnerInstructions,
        model: plan.defaultModel,
        temperature: String(n.temperature),
        token_budget: n.tokenBudget,
        max_tokens: n.maxTokens,
        attempts_allowed: n.attemptsAllowed,
        ai_grading_enabled: true,
        use_program_kb: true,
      });
    }
  }

  // 4) Linear edges connecting node[i] → node[i+1].
  // null condition is the path engine's "source must be completed" semantic
  // — exactly what a linear flow wants. No need for an explicit kind.
  if (insertedNodeIds.length > 1) {
    const edges = [];
    for (let i = 0; i < insertedNodeIds.length - 1; i++) {
      edges.push({
        program_id: program.id,
        source_node_id: insertedNodeIds[i],
        target_node_id: insertedNodeIds[i + 1],
        condition: null,
      });
    }
    await admin.from("path_edges").insert(edges);
  }

  // 5) Log usage so generation cost appears on /org/billing + dashboard.
  await logUsage({
    organizationId: session.activeOrganizationId,
    programId: program.id,
    userId: session.user.id,
    kind: "chat",
    model: modelUsed,
    promptTokens: inputTokens,
    completionTokens: outputTokens,
  });

  revalidatePath("/dashboard");
  revalidatePath("/programs");
  return {
    ok: true,
    programId: program.id,
    nodeCount: insertedNodeIds.length,
    inputTokens,
    outputTokens,
  };
}
