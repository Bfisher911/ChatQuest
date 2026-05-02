"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

const assignSchema = z.object({
  learnerId: z.string().uuid(),
  programId: z.string().uuid(),
});

/**
 * Provision an existing learner seat onto a specific Chatrail.
 *
 * Preconditions:
 *  - Caller is an instructor / org admin / super admin in the program's org.
 *  - Target user is already an `organization_members` row with role=learner
 *    in the same org (i.e., their seat is already provisioned).
 */
export async function assignLearnerToChatrail(
  learnerId: string,
  programId: string,
) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can assign learners." };
  }

  const parsed = assignSchema.safeParse({ learnerId, programId });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  // Verify the program is in the caller's active org (RLS would also catch).
  const { data: program } = await supabase
    .from("programs")
    .select("id, organization_id")
    .eq("id", parsed.data.programId)
    .maybeSingle();
  if (!program) return { ok: false as const, error: "Chatrail not found" };
  if (program.organization_id !== session.activeOrganizationId) {
    return { ok: false as const, error: "Chatrail belongs to a different organization." };
  }

  const admin = createServiceRoleClient();
  // Verify learner is an active member of the same org.
  const { data: m } = await admin
    .from("organization_members")
    .select("id, role, is_active")
    .eq("organization_id", program.organization_id)
    .eq("user_id", parsed.data.learnerId)
    .maybeSingle();
  if (!m || !m.is_active) {
    return { ok: false as const, error: "Learner isn't a member of this organization." };
  }

  const { error } = await admin
    .from("program_enrollments")
    .upsert(
      {
        program_id: parsed.data.programId,
        user_id: parsed.data.learnerId,
        status: "active",
      },
      { onConflict: "program_id,user_id" },
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seats");
  revalidatePath(`/programs/${parsed.data.programId}/roster`);
  return { ok: true as const };
}

/**
 * Revoke a learner's enrollment on a specific Chatrail. Doesn't free the
 * seat itself (the learner still occupies an org_member row); just removes
 * the Chatrail-level assignment.
 */
export async function unassignLearnerFromChatrail(
  learnerId: string,
  programId: string,
) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can unassign." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("program_enrollments")
    .delete()
    .eq("program_id", programId)
    .eq("user_id", learnerId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seats");
  return { ok: true as const };
}
