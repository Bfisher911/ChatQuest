"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/auth/rbac";

const perCriterionSchema = z.array(
  z.object({
    criterion_id: z.string().uuid(),
    score: z.coerce.number().nonnegative(),
    rationale: z.string().optional().nullable(),
  }),
);

const saveGradeSchema = z.object({
  gradeId: z.string().uuid(),
  programId: z.string().uuid(),
  status: z.enum(["graded", "needs_revision", "excused"]),
  score: z.coerce.number().nonnegative().nullable(),
  maxScore: z.coerce.number().nonnegative().nullable(),
  comment: z.string().optional().nullable(),
  /** JSON-encoded per-criterion array (criterion_id, score, rationale). */
  perCriterion: z.string().optional().nullable(),
});

export async function saveGrade(formData: FormData) {
  const user = await requireSessionUser();
  const rawPerCrit = formData.get("perCriterion");
  const parsed = saveGradeSchema.safeParse({
    gradeId: formData.get("gradeId"),
    programId: formData.get("programId"),
    status: formData.get("status"),
    score: formData.get("score") || null,
    maxScore: formData.get("maxScore") || null,
    comment: formData.get("comment") || null,
    perCriterion: typeof rawPerCrit === "string" ? rawPerCrit : null,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const pct =
    parsed.data.score != null && parsed.data.maxScore && parsed.data.maxScore > 0
      ? (parsed.data.score / parsed.data.maxScore) * 100
      : null;

  const { error: gradeErr } = await supabase
    .from("grades")
    .update({
      status: parsed.data.status,
      score: parsed.data.score,
      max_score: parsed.data.maxScore,
      percentage: pct,
      instructor_comment: parsed.data.comment,
      graded_by: user.id,
      graded_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.gradeId);
  if (gradeErr) return { ok: false as const, error: gradeErr.message };

  // Persist per-criterion rubric scores so learners can see the breakdown.
  if (parsed.data.perCriterion) {
    try {
      const arr = perCriterionSchema.parse(JSON.parse(parsed.data.perCriterion));
      if (arr.length > 0) {
        // Wipe + re-insert (small N; simpler than per-row upsert + cleanup).
        await supabase.from("rubric_scores").delete().eq("grade_id", parsed.data.gradeId);
        await supabase.from("rubric_scores").insert(
          arr.map((s) => ({
            grade_id: parsed.data.gradeId,
            criterion_id: s.criterion_id,
            score: s.score,
            comment: s.rationale ?? null,
          })),
        );
      }
    } catch (err) {
      // Don't fail the save on bad per-criterion data — the grade itself is in.
      console.error("[saveGrade] per-criterion parse failed:", err);
    }
  }

  // Mirror grade status on the conversation + auto-award certificates.
  const { data: grade } = await supabase
    .from("grades")
    .select("conversation_id, learner_id, organization_id")
    .eq("id", parsed.data.gradeId)
    .single();
  if (grade) {
    const convStatus =
      parsed.data.status === "graded"
        ? "graded"
        : parsed.data.status === "needs_revision"
        ? "needs_revision"
        : "graded";
    await supabase.from("conversations").update({ status: convStatus }).eq("id", grade.conversation_id);

    if (parsed.data.status === "graded") {
      const { maybeAwardCertificates } = await import("@/lib/path/actions");
      await maybeAwardCertificates(
        parsed.data.programId,
        grade.learner_id,
        grade.organization_id,
      );
    }

    // Fire a learner notification (Phase T).
    const { createNotification } = await import("@/lib/notifications/create");
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const adm = createServiceRoleClient();
    const { data: ctx } = await adm
      .from("path_nodes")
      .select("id, title, program_id, programs:programs(title)")
      .eq("id", (await adm.from("grades").select("node_id").eq("id", parsed.data.gradeId).single()).data?.node_id)
      .maybeSingle();
    type CtxRow = { id: string; title: string; program_id: string; programs: { title: string }[] | { title: string } | null };
    const c = ctx as unknown as CtxRow | null;
    const programTitle = (() => {
      const p = c?.programs;
      if (!p) return "your Chatrail";
      return Array.isArray(p) ? p[0]?.title ?? "your Chatrail" : p.title;
    })();
    const isReturned = parsed.data.status === "needs_revision";
    await createNotification({
      userId: grade.learner_id,
      organizationId: grade.organization_id,
      kind: "grade_returned",
      title: isReturned
        ? `Revision requested: ${c?.title ?? "your work"}`
        : `Graded: ${c?.title ?? "your work"}`,
      body: parsed.data.comment ?? null,
      href: `/learn/${parsed.data.programId}/${c?.id}/grade`,
      metadata: { programTitle, score: parsed.data.score, status: parsed.data.status },
    });
  }

  revalidatePath(`/programs/${parsed.data.programId}/gradebook`);
  revalidatePath(`/learn/${parsed.data.programId}`);
  return { ok: true as const };
}
