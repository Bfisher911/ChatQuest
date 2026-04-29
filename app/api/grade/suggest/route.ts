// Returns an AI suggested rubric score for a given submission. Streamed? No —
// the response is small JSON, so we go non-streaming for simpler UI consumption.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { suggestRubricScore } from "@/lib/llm/grading";
import { logUsage } from "@/lib/llm/usage";

export const runtime = "nodejs";

const schema = z.object({ submissionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { submissionId } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: submission } = await admin
    .from("submissions")
    .select("id, conversation_id, node_id, program_id, organization_id, learner_id")
    .eq("id", submissionId)
    .single();
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ensure caller has rights via RLS-aware client.
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("id", submission.program_id)
    .single();
  if (!program) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bot } = await admin
    .from("chatbot_configs")
    .select("rubric_id, learner_instructions, model")
    .eq("node_id", submission.node_id)
    .single();
  if (!bot?.rubric_id) {
    return NextResponse.json({ error: "Attach a rubric to this bot first." }, { status: 400 });
  }

  const { data: rubric } = await admin
    .from("rubrics")
    .select("id, name")
    .eq("id", bot.rubric_id)
    .single();
  const { data: criteria } = await admin
    .from("rubric_criteria")
    .select("id, name, description, max_points, display_order")
    .eq("rubric_id", bot.rubric_id)
    .order("display_order", { ascending: true });

  const { data: messages } = await admin
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", submission.conversation_id)
    .order("created_at", { ascending: true });

  try {
    const suggestion = await suggestRubricScore({
      rubricName: rubric?.name ?? "Rubric",
      criteria: (criteria ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        max_points: c.max_points,
      })),
      transcript: (messages ?? []).map((m) => ({ role: m.role, content: m.content })),
      learnerInstructions: bot.learner_instructions,
      model: bot.model ?? undefined,
    });

    await logUsage({
      organizationId: submission.organization_id,
      programId: submission.program_id,
      nodeId: submission.node_id,
      userId: user.id,
      kind: "grade_suggest",
      model: suggestion.model,
      promptTokens: suggestion.inputTokens,
      completionTokens: suggestion.outputTokens,
    });

    return NextResponse.json({
      ok: true,
      summary: suggestion.summary,
      total_score: suggestion.total_score,
      per_criterion: suggestion.per_criterion,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
