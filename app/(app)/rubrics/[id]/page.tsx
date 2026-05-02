import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Frame, Btn, Icon, Chip } from "@/components/brutalist";
import { RubricEditor } from "./rubric-editor";

export const dynamic = "force-dynamic";

export default async function RubricEditPage({ params }: { params: { id: string } }) {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: rubric } = await supabase
    .from("rubrics")
    .select("id, name, description, total_points, is_visible_to_learners, organization_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!rubric) notFound();

  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select("id, name, description, max_points, display_order")
    .eq("rubric_id", rubric.id)
    .order("display_order", { ascending: true });

  // Show which chatbot nodes are using this rubric.
  const { data: attached } = await supabase
    .from("chatbot_configs")
    .select("node_id, node:path_nodes(title, program_id, program:programs(title))")
    .eq("rubric_id", rubric.id);

  type AttachedRow = {
    node_id: string;
    node: { title: string; program_id: string; program: { title: string }[] | { title: string } | null }[] | { title: string; program_id: string; program: { title: string }[] | { title: string } | null } | null;
  };
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;
  const attachedRows = ((attached ?? []) as AttachedRow[]).map((a) => {
    const node = pickOne(a.node);
    const program = pickOne(node?.program);
    return {
      nodeId: a.node_id,
      nodeTitle: node?.title ?? "",
      programId: node?.program_id ?? "",
      programTitle: program?.title ?? "",
    };
  });

  return (
    <div className="cq-page" style={{ maxWidth: 920 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Btn sm ghost asChild>
          <Link href="/rubrics">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> RUBRICS
          </Link>
        </Btn>
        <Chip>{rubric.total_points ?? 0} PTS</Chip>
        {rubric.is_visible_to_learners ? <Chip ghost>VISIBLE TO LEARNERS</Chip> : null}
      </div>

      <Eyebrow>EDIT RUBRIC</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        {rubric.name.toUpperCase()}
      </h1>

      <RubricEditor
        rubric={{
          id: rubric.id,
          name: rubric.name,
          description: rubric.description ?? "",
          isVisibleToLearners: rubric.is_visible_to_learners,
        }}
        initialCriteria={(criteria ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? "",
          max_points: c.max_points,
          display_order: c.display_order,
        }))}
        attachedTo={attachedRows}
      />
    </div>
  );
}
