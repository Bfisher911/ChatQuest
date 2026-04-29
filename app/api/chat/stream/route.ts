// SSE chat streaming endpoint.
// 1. Reads the chatbot config + KB scope
// 2. Retrieves top-k KB chunks for the latest user message
// 3. Streams the model response while persisting to conversation_messages
// 4. Logs usage to usage_logs

import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { streamChat, type ChatModel, type ChatMessage } from "@/lib/llm/provider";
import { searchKnowledge } from "@/lib/rag/search";
import { buildSystemPrompt } from "@/lib/llm/prompt";
import { logUsage } from "@/lib/llm/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reqSchema = z.object({
  conversationId: z.string().uuid(),
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
  const { conversationId, message } = parsed.data;

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

  const admin = createServiceRoleClient();

  // 1. Conversation + ownership
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("id, learner_id, node_id, program_id, organization_id, status, total_prompt_tokens, total_completion_tokens")
    .eq("id", conversationId)
    .single();
  if (convErr || !conv) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
  }
  if (conv.learner_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  if (conv.status === "submitted" || conv.status === "graded" || conv.status === "completed") {
    return new Response(JSON.stringify({ error: "This attempt has already been submitted." }), { status: 400 });
  }

  // 2. Bot config
  const { data: bot } = await admin
    .from("chatbot_configs")
    .select("model, temperature, max_tokens, token_budget, system_prompt, conversation_goal, completion_criteria, use_program_kb")
    .eq("node_id", conv.node_id)
    .single();
  if (!bot) {
    return new Response(JSON.stringify({ error: "Chatbot config missing" }), { status: 400 });
  }

  // Token budget check (Phase 1 soft cap).
  const used = (conv.total_prompt_tokens ?? 0) + (conv.total_completion_tokens ?? 0);
  if (bot.token_budget && used >= bot.token_budget) {
    return new Response(
      JSON.stringify({ error: "Token budget for this attempt is used up." }),
      { status: 400 },
    );
  }

  // 3. Existing transcript
  const { data: history } = await admin
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  // 4. Persist learner's new message before we start streaming the reply.
  const { error: insertErr } = await admin.from("conversation_messages").insert({
    conversation_id: conv.id,
    role: "user",
    content: message,
  });
  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
  }
  if (conv.status === "in_progress") {
    // already in progress
  } else if (conv.status === "not_started") {
    await admin.from("conversations").update({ status: "in_progress" }).eq("id", conv.id);
  }

  // 5. KB retrieval
  let citations: Awaited<ReturnType<typeof searchKnowledge>> = [];
  if (bot.use_program_kb) {
    const { data: collections } = await admin
      .from("knowledge_collections")
      .select("id")
      .eq("program_id", conv.program_id);
    const collectionIds = (collections ?? []).map((c) => c.id);
    if (collectionIds.length > 0) {
      try {
        citations = await searchKnowledge({
          organizationId: conv.organization_id,
          collectionIds,
          query: message,
          limit: 5,
        });
      } catch (err) {
        console.error("[chat] KB search failed:", err);
      }
    }
  }

  // 6. Build prompt + start stream
  const systemPrompt = buildSystemPrompt({
    basePrompt: bot.system_prompt,
    conversationGoal: bot.conversation_goal,
    completionCriteria: bot.completion_criteria,
    citations,
  });

  const messages: ChatMessage[] = [
    ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
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

        // Persist assistant turn
        await admin.from("conversation_messages").insert({
          conversation_id: conv.id,
          role: "assistant",
          content: assembled,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          model,
          citations: citations.map((c) => ({
            chunk_id: c.chunk_id,
            file_id: c.file_id,
            filename: c.filename,
            page: c.page_number,
            score: c.score,
          })),
        });
        await admin
          .from("conversations")
          .update({
            total_prompt_tokens: (conv.total_prompt_tokens ?? 0) + promptTokens,
            total_completion_tokens: (conv.total_completion_tokens ?? 0) + completionTokens,
          })
          .eq("id", conv.id);
        await logUsage({
          organizationId: conv.organization_id,
          programId: conv.program_id,
          nodeId: conv.node_id,
          conversationId: conv.id,
          userId: user.id,
          kind: "chat",
          model,
          promptTokens,
          completionTokens,
        });

        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ promptTokens, completionTokens })}\n\n`),
        );
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`),
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
