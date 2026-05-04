import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, IconBtn, Icon, Btn } from "@/components/brutalist";
import { GradebookView } from "./gradebook-view";

export const dynamic = "force-dynamic";

export default async function GradebookPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  // Columns = graded-able nodes
  const { data: nodes } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, display_order")
    .eq("program_id", params.id)
    .in("type", ["bot"])
    .order("display_order", { ascending: true });

  // Rows = enrolled learners
  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("user_id, user:users(id, email, full_name, display_name)")
    .eq("program_id", params.id);

  type EnrollmentRow = { user_id: string; user: { id: string; email: string; full_name: string | null; display_name: string | null } | null };
  const learners = ((enrollments ?? []) as unknown as EnrollmentRow[])
    .map((e) => e.user)
    .filter((u): u is NonNullable<EnrollmentRow["user"]> => Boolean(u));

  // Cell data = grades. Order newest-first then dedup by (learner, node)
  // so cells consistently show the LATEST attempt — without an order
  // clause, multi-attempt nodes rendered whichever row Postgres returned
  // last, which was non-deterministic.
  const { data: grades } = await supabase
    .from("grades")
    .select("id, learner_id, node_id, status, score, max_score, percentage, submission_id, created_at")
    .eq("program_id", params.id)
    .order("created_at", { ascending: false });

  type GradeRow = {
    id: string;
    learner_id: string;
    node_id: string;
    status: string;
    score: number | string | null;
    max_score: number | string | null;
    percentage: number | string | null;
    submission_id: string;
    created_at: string;
  };
  const seen = new Set<string>();
  const latestGrades: GradeRow[] = [];
  for (const g of (grades ?? []) as GradeRow[]) {
    const key = `${g.learner_id}:${g.node_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latestGrades.push(g);
  }

  // Submission delivery flags
  const submissionIds = latestGrades.map((g) => g.submission_id);
  const { data: submissionsRows } = await supabase
    .from("submissions")
    .select("id, delivery_status")
    .in("id", submissionIds.length ? submissionIds : ["00000000-0000-0000-0000-000000000000"]);
  const subById = new Map<string, string>();
  for (const s of submissionsRows ?? []) subById.set(s.id, s.delivery_status);

  return (
    <GradebookView
      programId={params.id}
      programTitle={program.title}
      nodes={nodes ?? []}
      learners={learners}
      grades={latestGrades.map((g) => ({
        ...g,
        delivery_status: g.submission_id ? subById.get(g.submission_id) ?? null : null,
      }))}
    />
  );
}
