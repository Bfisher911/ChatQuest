"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { summarizeConversation } from "@/lib/llm/grading";
import { logUsage } from "@/lib/llm/usage";

/**
 * Start (or resume) a chat attempt for a learner on a node. Returns the
 * conversation id. Honors `attempts_allowed` and `requires submit button` settings.
 */
export async function startConversation(programId: string, nodeId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const supabase = createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, organization_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program) return { ok: false as const, error: "Program not found" };

  const { data: bot } = await supabase
    .from("chatbot_configs")
    .select("attempts_allowed, allow_retry_after_feedback")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (!bot) return { ok: false as const, error: "Chatbot config not found" };

  // Find an in-progress attempt first.
  const { data: open } = await supabase
    .from("conversations")
    .select("id, attempt_number, status")
    .eq("program_id", programId)
    .eq("node_id", nodeId)
    .eq("learner_id", session.user.id)
    .order("attempt_number", { ascending: false })
    .limit(1);

  const last = open?.[0];
  if (last && (last.status === "in_progress" || last.status === "not_started")) {
    return { ok: true as const, conversationId: last.id, attempt: last.attempt_number };
  }
  if (last && last.status === "needs_revision" && bot.allow_retry_after_feedback) {
    // OK to start a new attempt
  } else if (last && (last.status === "submitted" || last.status === "graded" || last.status === "completed")) {
    if ((last.attempt_number ?? 0) >= (bot.attempts_allowed ?? 1)) {
      return { ok: false as const, error: "All attempts used. Contact your instructor for a retry." };
    }
  }

  const nextAttempt = (last?.attempt_number ?? 0) + 1;
  const { data: created, error: createErr } = await supabase
    .from("conversations")
    .insert({
      program_id: programId,
      node_id: nodeId,
      learner_id: session.user.id,
      organization_id: program.organization_id,
      attempt_number: nextAttempt,
      status: "in_progress",
    })
    .select("id, attempt_number")
    .single();
  if (createErr || !created) return { ok: false as const, error: createErr?.message ?? "Failed to start" };

  return { ok: true as const, conversationId: created.id, attempt: created.attempt_number };
}

/**
 * Submit a conversation for grading. Captures a submission row, asks the model
 * for a short conversation summary, marks status submitted, and creates a pending grade.
 */
export async function submitConversation(conversationId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const admin = createServiceRoleClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, program_id, node_id, learner_id, organization_id, attempt_number, status")
    .eq("id", conversationId)
    .single();
  if (!conv) return { ok: false as const, error: "Conversation not found" };
  if (conv.learner_id !== session.user.id) return { ok: false as const, error: "Forbidden" };
  if (conv.status === "submitted" || conv.status === "graded" || conv.status === "completed") {
    return { ok: false as const, error: "Already submitted." };
  }

  // Compute delivery status.
  const { data: node } = await admin
    .from("path_nodes")
    .select("due_at, points")
    .eq("id", conv.node_id)
    .single();
  const now = new Date();
  const delivery = node?.due_at && new Date(node.due_at) < now ? "late" : "on_time";

  // Insert submission.
  const { data: submission, error: subErr } = await admin
    .from("submissions")
    .insert({
      conversation_id: conv.id,
      program_id: conv.program_id,
      node_id: conv.node_id,
      learner_id: conv.learner_id,
      organization_id: conv.organization_id,
      attempt_number: conv.attempt_number,
      delivery_status: delivery,
    })
    .select("id")
    .single();
  if (subErr || !submission) return { ok: false as const, error: subErr?.message ?? "Failed to submit" };

  // Pull rubric for grading suggestion.
  const { data: bot } = await admin
    .from("chatbot_configs")
    .select("rubric_id, ai_grading_enabled, model")
    .eq("node_id", conv.node_id)
    .single();
  let aiSummary: string | null = null;
  let aiSuggested: number | null = null;
  let rubricId: string | null = bot?.rubric_id ?? null;
  if (bot?.ai_grading_enabled) {
    const { data: messages } = await admin
      .from("conversation_messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    try {
      const sum = await summarizeConversation({
        transcript: (messages ?? []).map((m) => ({ role: m.role, content: m.content })),
        model: bot.model ?? undefined,
      });
      aiSummary = sum.summary;
      await logUsage({
        organizationId: conv.organization_id,
        programId: conv.program_id,
        nodeId: conv.node_id,
        conversationId: conv.id,
        userId: session.user.id,
        kind: "grade_suggest",
        model: sum.model,
        promptTokens: sum.inputTokens,
        completionTokens: sum.outputTokens,
      });
    } catch (err) {
      console.error("[submit] summarize failed:", err);
    }
  }

  // Insert pending grade row so it shows up in the gradebook.
  await admin.from("grades").insert({
    submission_id: submission.id,
    conversation_id: conv.id,
    program_id: conv.program_id,
    node_id: conv.node_id,
    learner_id: conv.learner_id,
    organization_id: conv.organization_id,
    rubric_id: rubricId,
    status: "pending_review",
    max_score: node?.points ?? null,
    ai_summary: aiSummary,
    ai_suggested_score: aiSuggested,
  });

  await admin
    .from("conversations")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), ai_summary: aiSummary })
    .eq("id", conv.id);

  revalidatePath(`/learn/${conv.program_id}`);
  revalidatePath(`/programs/${conv.program_id}/gradebook`);
  return { ok: true as const };
}
