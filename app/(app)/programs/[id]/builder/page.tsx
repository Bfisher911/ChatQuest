import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PathBuilder } from "@/components/builder/path-builder";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  const { data: nodes } = await supabase
    .from("path_nodes")
    .select("id, type, title, display_order, x, y, points, is_required, config, available_at, due_at")
    .eq("program_id", params.id)
    .order("display_order", { ascending: true });

  const { data: edges } = await supabase
    .from("path_edges")
    .select("source_node_id, target_node_id, condition")
    .eq("program_id", params.id);

  return (
    <PathBuilder
      programId={params.id}
      initialNodes={(nodes ?? []) as Parameters<typeof PathBuilder>[0]["initialNodes"]}
      initialEdges={(edges ?? []) as Parameters<typeof PathBuilder>[0]["initialEdges"]}
    />
  );
}
