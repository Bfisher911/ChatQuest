"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/auth/rbac";

const saveGradeSchema = z.object({
  gradeId: z.string().uuid(),
  programId: z.string().uuid(),
  status: z.enum(["graded", "needs_revision", "excused"]),
  score: z.coerce.number().nonnegative().nullable(),
  maxScore: z.coerce.number().nonnegative().nullable(),
  comment: z.string().optional().nullable(),
});

export async function saveGrade(formData: FormData) {
  const user = await requireSessionUser();
  const parsed = saveGradeSchema.safeParse({
    gradeId: formData.get("gradeId"),
    programId: formData.get("programId"),
    status: formData.get("status"),
    score: formData.get("score") || null,
    maxScore: formData.get("maxScore") || null,
    comment: formData.get("comment") || null,
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
  }

  revalidatePath(`/programs/${parsed.data.programId}/gradebook`);
  revalidatePath(`/learn/${parsed.data.programId}`);
  return { ok: true as const };
}
