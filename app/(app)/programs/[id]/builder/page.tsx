import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PathBuilder } from "@/components/builder/path-builder";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, organization_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  const [{ data: nodes }, { data: edges }, { data: rubrics }] = await Promise.all([
    supabase
      .from("path_nodes")
      .select("id, type, title, display_order, x, y, points, is_required, config, available_at, due_at")
      .eq("program_id", params.id)
      .order("display_order", { ascending: true }),
    supabase
      .from("path_edges")
      .select("source_node_id, target_node_id, condition")
      .eq("program_id", params.id),
    supabase
      .from("rubrics")
      .select("id, name, total_points")
      .eq("organization_id", program.organization_id)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch chatbot_configs for every bot node in this program (for the inline inspector).
  const botNodeIds = (nodes ?? []).filter((n) => n.type === "bot").map((n) => n.id);
  const { data: botConfigs } = botNodeIds.length
    ? await supabase
        .from("chatbot_configs")
        .select(
          "node_id, system_prompt, learner_instructions, model, temperature, token_budget, max_tokens, attempts_allowed, rubric_id, conversation_goal, completion_criteria, ai_grading_enabled, allow_retry_after_feedback",
        )
        .in("node_id", botNodeIds)
    : { data: [] };

  return (
    <PathBuilder
      programId={params.id}
      initialNodes={(nodes ?? []) as Parameters<typeof PathBuilder>[0]["initialNodes"]}
      initialEdges={(edges ?? []) as Parameters<typeof PathBuilder>[0]["initialEdges"]}
      rubrics={(rubrics ?? []) as Parameters<typeof PathBuilder>[0]["rubrics"]}
      botConfigs={(botConfigs ?? []) as Parameters<typeof PathBuilder>[0]["botConfigs"]}
    />
  );
}
