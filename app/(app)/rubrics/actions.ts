"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

// ───────── helpers ─────────

function pointsFromCriteria(criteria: { max_points: number }[]): number {
  return criteria.reduce((a, c) => a + (Number(c.max_points) || 0), 0);
}

async function recomputeRubricTotal(rubricId: string) {
  const admin = createServiceRoleClient();
  const { data: criteria } = await admin
    .from("rubric_criteria")
    .select("max_points")
    .eq("rubric_id", rubricId);
  const total = pointsFromCriteria(criteria ?? []);
  await admin.from("rubrics").update({ total_points: total }).eq("id", rubricId);
}

// ───────── rubric CRUD ─────────

const createRubricSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export async function createRubric(formData: FormData) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) {
    return { ok: false as const, error: "No active organization." };
  }
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can build rubrics." };
  }

  const parsed = createRubricSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("rubrics")
    .insert({
      organization_id: session.activeOrganizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: session.user.id,
      total_points: 0,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Failed to create rubric" };

  // Seed with a single starter criterion so the editor isn't empty.
  await supabase.from("rubric_criteria").insert({
    rubric_id: data.id,
    name: "Criterion 1",
    description: "What you're scoring on",
    max_points: 5,
    display_order: 0,
  });
  await recomputeRubricTotal(data.id);

  revalidatePath("/rubrics");
  redirect(`/rubrics/${data.id}`);
}

const updateRubricSchema = z.object({
  rubricId: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  isVisibleToLearners: z.coerce.boolean().default(false),
});

export async function updateRubric(input: z.infer<typeof updateRubricSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const parsed = updateRubricSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase
    .from("rubrics")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      is_visible_to_learners: parsed.data.isVisibleToLearners,
    })
    .eq("id", parsed.data.rubricId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/rubrics");
  revalidatePath(`/rubrics/${parsed.data.rubricId}`);
  return { ok: true as const };
}

// Clone a rubric (criteria + levels) under the same org. The duplicate is a
// fresh rubric_id so it never collides with the original's chatbot
// attachments, and gets " (Copy)" appended to disambiguate at the list view.
export async function duplicateRubric(rubricId: string) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization." };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can duplicate rubrics." };
  }
  const admin = createServiceRoleClient();

  const { data: src } = await admin
    .from("rubrics")
    .select("id, organization_id, name, description, total_points, is_visible_to_learners")
    .eq("id", rubricId)
    .maybeSingle();
  if (!src) return { ok: false as const, error: "Rubric not found" };
  if (src.organization_id !== session.activeOrganizationId && !session.user.isSuperAdmin) {
    return { ok: false as const, error: "Cross-org duplication refused." };
  }

  // 1) Insert the new rubric row.
  const { data: dup, error: dupErr } = await admin
    .from("rubrics")
    .insert({
      organization_id: src.organization_id,
      name: `${src.name} (Copy)`,
      description: src.description,
      total_points: src.total_points,
      is_visible_to_learners: src.is_visible_to_learners,
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (dupErr || !dup) return { ok: false as const, error: dupErr?.message ?? "Duplicate failed" };

  // 2) Copy criteria.
  const { data: srcCrits } = await admin
    .from("rubric_criteria")
    .select("id, name, description, max_points, display_order")
    .eq("rubric_id", rubricId)
    .order("display_order", { ascending: true });

  if (srcCrits && srcCrits.length > 0) {
    const oldToNewCrit = new Map<string, string>();
    const inserted = await admin
      .from("rubric_criteria")
      .insert(
        srcCrits.map((c) => ({
          rubric_id: dup.id,
          name: c.name,
          description: c.description,
          max_points: c.max_points,
          display_order: c.display_order,
        })),
      )
      .select("id, display_order");
    if (inserted.data) {
      // Pair by display_order so the level copy can map old crit → new crit.
      const insertedSorted = [...inserted.data].sort(
        (a, b) => Number(a.display_order) - Number(b.display_order),
      );
      const srcSorted = [...srcCrits].sort((a, b) => Number(a.display_order) - Number(b.display_order));
      for (let i = 0; i < srcSorted.length && i < insertedSorted.length; i++) {
        oldToNewCrit.set(srcSorted[i].id, insertedSorted[i].id);
      }
    }

    // 3) Copy levels (if any) attached to each criterion.
    const oldCritIds = srcCrits.map((c) => c.id);
    const { data: srcLevels } = await admin
      .from("rubric_levels")
      .select("criterion_id, label, points, description, display_order")
      .in("criterion_id", oldCritIds);
    if (srcLevels && srcLevels.length > 0) {
      const newLevels = srcLevels
        .map((l) => {
          const newCritId = oldToNewCrit.get(l.criterion_id);
          if (!newCritId) return null;
          return {
            criterion_id: newCritId,
            label: l.label,
            points: l.points,
            description: l.description,
            display_order: l.display_order,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);
      if (newLevels.length > 0) {
        await admin.from("rubric_levels").insert(newLevels);
      }
    }
  }

  revalidatePath("/rubrics");
  return { ok: true as const, rubricId: dup.id };
}

export async function deleteRubric(rubricId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const supabase = createClient();
  // Guard against deletion if attached to a bot.
  const { data: attached } = await supabase
    .from("chatbot_configs")
    .select("id")
    .eq("rubric_id", rubricId)
    .limit(1);
  if (attached && attached.length > 0) {
    return {
      ok: false as const,
      error: "This rubric is attached to one or more chatbot nodes. Detach it first.",
    };
  }
  const { error } = await supabase.from("rubrics").delete().eq("id", rubricId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/rubrics");
  return { ok: true as const };
}

// ───────── criterion CRUD ─────────

const upsertCriterionSchema = z.object({
  rubricId: z.string().uuid(),
  criterionId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  maxPoints: z.coerce.number().int().min(1).max(100),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export async function upsertCriterion(input: z.infer<typeof upsertCriterionSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const parsed = upsertCriterionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  if (parsed.data.criterionId) {
    const { error } = await supabase
      .from("rubric_criteria")
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        max_points: parsed.data.maxPoints,
        display_order: parsed.data.displayOrder,
      })
      .eq("id", parsed.data.criterionId);
    if (error) return { ok: false as const, error: error.message };
  } else {
    // Default display_order = max + 1.
    const { data: existing } = await supabase
      .from("rubric_criteria")
      .select("display_order")
      .eq("rubric_id", parsed.data.rubricId)
      .order("display_order", { ascending: false })
      .limit(1);
    const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;
    const { error } = await supabase.from("rubric_criteria").insert({
      rubric_id: parsed.data.rubricId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      max_points: parsed.data.maxPoints,
      display_order: nextOrder,
    });
    if (error) return { ok: false as const, error: error.message };
  }

  await recomputeRubricTotal(parsed.data.rubricId);
  revalidatePath(`/rubrics/${parsed.data.rubricId}`);
  return { ok: true as const };
}

export async function deleteCriterion(rubricId: string, criterionId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const supabase = createClient();
  const { error } = await supabase.from("rubric_criteria").delete().eq("id", criterionId);
  if (error) return { ok: false as const, error: error.message };
  await recomputeRubricTotal(rubricId);
  revalidatePath(`/rubrics/${rubricId}`);
  return { ok: true as const };
}

const reorderSchema = z.object({
  rubricId: z.string().uuid(),
  criterionIds: z.array(z.string().uuid()),
});

export async function reorderCriteria(input: z.infer<typeof reorderSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = createClient();
  // Update each row's display_order in turn. Small N, no big deal.
  for (let i = 0; i < parsed.data.criterionIds.length; i++) {
    await supabase
      .from("rubric_criteria")
      .update({ display_order: i })
      .eq("id", parsed.data.criterionIds[i])
      .eq("rubric_id", parsed.data.rubricId);
  }
  revalidatePath(`/rubrics/${parsed.data.rubricId}`);
  return { ok: true as const };
}
