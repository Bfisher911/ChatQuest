// Ephemeral preview chat for bot-node authoring.
//
// Lets instructors / TAs / org_admins / super_admins test a chatbot node
// against the actual config (system prompt, model, temperature, KB
// retrieval) WITHOUT creating a real conversation, persisting messages,
// or polluting the gradebook.
//
// Usage is still logged so token costs against the org's monthly budget
// are honored — preview chats aren't free.

import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { streamChat, type ChatModel, type ChatMessage } from "@/lib/llm/provider";
import { friendlyLLMError } from "@/lib/llm/errors";
import { searchKnowledge } from "@/lib/rag/search";
import { buildSystemPrompt } from "@/lib/llm/prompt";
import { logUsage } from "@/lib/llm/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reqSchema = z.object({
  nodeId: z.string().uuid(),
  /** Transcript so far — never persisted server-side. */
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = reqSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { nodeId, history, message } = parsed.data;

  const userClient = createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Per-user rate limit — same envelope as production chat (30/min).
  const { limit } = await import("@/lib/ratelimit");
  const rl = await limit(`chat-preview:${user.id}`, { max: 30, windowSec: 60 });
  if (!rl.success) {
    return new Response(JSON.stringify({ error: "Slow down — too many preview messages." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createServiceRoleClient();

  // Resolve the node + parent program + the caller's role in that org.
  const { data: node } = await admin
    .from("path_nodes")
    .select("id, type, program_id, programs:programs(id, organization_id)")
    .eq("id", nodeId)
    .maybeSingle();
  if (!node) {
    return new Response(JSON.stringify({ error: "Node not found" }), { status: 404 });
  }
  if (node.type !== "bot") {
    return new Response(JSON.stringify({ error: "Preview only works on bot nodes." }), { status: 400 });
  }
  type ProgramRef = { id: string; organization_id: string };
  const programRef = (Array.isArray(node.programs) ? node.programs[0] : node.programs) as ProgramRef | null;
  if (!programRef) {
    return new Response(JSON.stringify({ error: "Program not found" }), { status: 404 });
  }
  const orgId = programRef.organization_id;

  // Staff-only gate. Super admins bypass; everyone else must hold a staff
  // role in the program's org.
  const { data: profile } = await admin
    .from("users")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  let isStaff = !!profile?.is_super_admin;
  if (!isStaff) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    isStaff =
      !!membership && ["instructor", "ta", "org_admin"].includes(membership.role);
  }
  if (!isStaff) {
    return new Response(JSON.stringify({ error: "Preview is available to Creators only." }), {
      status: 403,
    });
  }

  // Bot config — fail loud if not yet authored.
  const { data: bot } = await admin
    .from("chatbot_configs")
    .select("model, temperature, max_tokens, system_prompt, conversation_goal, completion_criteria, use_program_kb")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (!bot) {
    return new Response(
      JSON.stringify({ error: "No chatbot config saved yet — save the node first to preview it." }),
      { status: 400 },
    );
  }

  // Plan-level monthly token cap still applies — preview burns real tokens.
  const { getMonthlyTokenUsage } = await import("@/lib/usage/check");
  const usageStatus = await getMonthlyTokenUsage(orgId);
  if (usageStatus.state === "exceeded") {
    return new Response(
      JSON.stringify({
        error: `Monthly token budget exhausted (${usageStatus.used.toLocaleString()} / ${usageStatus.budget.toLocaleString()}).`,
      }),
      { status: 402 },
    );
  }

  // KB retrieval — same as the real chat path.
  let citations: Awaited<ReturnType<typeof searchKnowledge>> = [];
  if (bot.use_program_kb) {
    const { data: collections } = await admin
      .from("knowledge_collections")
      .select("id")
      .eq("program_id", programRef.id);
    const collectionIds = (collections ?? []).map((c) => c.id);
    if (collectionIds.length > 0) {
      try {
        citations = await searchKnowledge({
          organizationId: orgId,
          collectionIds,
          query: message,
          limit: 5,
        });
      } catch (err) {
        console.error("[chat-preview] KB search failed:", err);
      }
    }
  }

  const systemPrompt = buildSystemPrompt({
    basePrompt: bot.system_prompt,
    conversationGoal: bot.conversation_goal,
    completionCriteria: bot.completion_criteria,
    citations,
  });

  const messages: ChatMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: message },
  ];

  const model = (bot.model as ChatModel) ?? "claude-haiku-4-5";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let assembled = "";
      let promptTokens = 0;
      let completionTokens = 0;
      try {
        for await (const chunk of streamChat({
          model,
          systemPrompt,
          temperature: Number(bot.temperature ?? 0.4),
          maxTokens: bot.max_tokens ?? 1024,
          messages,
        })) {
          if (chunk.delta) {
            assembled += chunk.delta;
            controller.enqueue(
              encoder.encode(`event: delta\ndata: ${JSON.stringify({ delta: chunk.delta })}\n\n`),
            );
          }
          if (chunk.done) {
            promptTokens = chunk.inputTokens ?? 0;
            completionTokens = chunk.outputTokens ?? 0;
          }
        }

        // Log usage so preview tokens count against the org budget. NO
        // conversation_messages / conversations rows are written.
        await logUsage({
          organizationId: orgId,
          programId: programRef.id,
          nodeId,
          conversationId: null,
          userId: user.id,
          kind: "chat-preview",
          model,
          promptTokens,
          completionTokens,
        });

        // Mirror an "assembled" length echo back so the client can verify
        // it received everything (helps debugging silent stream truncation).
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              promptTokens,
              completionTokens,
              chars: assembled.length,
            })}\n\n`,
          ),
        );
        controller.close();
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : "Stream error";
        const friendly = friendlyLLMError(raw);
        console.error("[chat-preview] LLM call failed:", err);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: friendly })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
