import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { startConversation } from "../../actions";
import { ChatScreen } from "@/components/chat/chat-screen";

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
    .select("id, title, organization_id")
    .eq("id", params.programId)
    .maybeSingle();
  if (!program) notFound();

  const { data: node } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, due_at, chatbot_configs(bot_name, avatar_initials, learner_instructions, model, token_budget, attempts_allowed)")
    .eq("id", params.nodeId)
    .maybeSingle();
  if (!node) notFound();
  if (node.type !== "bot") {
    return (
      <div className="cq-page">
        <p style={{ fontFamily: "var(--font-mono)" }}>
          {node.type.toUpperCase()} nodes are not yet implemented for learners — coming in Phase 2.
        </p>
      </div>
    );
  }
  const cfg = (node.chatbot_configs as unknown) as {
    bot_name: string;
    avatar_initials: string;
    learner_instructions: string | null;
    model: string;
    token_budget: number;
    attempts_allowed: number;
  }[] | null;
  const bot = cfg?.[0];

  // Ensure or resume an attempt.
  const start = await startConversation(params.programId, params.nodeId);
  if (!start.ok) {
    return (
      <div className="cq-page">
        <div className="cq-form-error">{start.error}</div>
      </div>
    );
  }

  // Pull existing messages so we can render history on first paint.
  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", start.conversationId)
    .order("created_at", { ascending: true });

  // Sibling nodes for the path rail.
  const { data: sibs } = await supabase
    .from("path_nodes")
    .select("id, title, type, display_order")
    .eq("program_id", params.programId)
    .order("display_order", { ascending: true });

  const { data: convStatuses } = await supabase
    .from("conversations")
    .select("node_id, status")
    .eq("program_id", params.programId)
    .eq("learner_id", session.user.id);

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
      pathNodes={(sibs ?? []).map((n, i) => ({
        id: n.id,
        title: n.title,
        type: n.type as string,
        index: i + 1,
        status:
          convStatuses?.find((c) => c.node_id === n.id)?.status === "graded" ||
          convStatuses?.find((c) => c.node_id === n.id)?.status === "completed" ||
          convStatuses?.find((c) => c.node_id === n.id)?.status === "submitted"
            ? "DONE"
            : n.id === params.nodeId
            ? "ACTIVE"
            : "AVAILABLE",
      }))}
    />
  );
}
