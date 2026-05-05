"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import type { UserRole } from "@/lib/db/types";

// ─────────── Organization rename / update ───────────

const updateOrgSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes."),
  orgType: z.enum(["school", "company", "training", "other"]).default("other"),
});

export async function updateOrganization(input: z.infer<typeof updateOrgSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can edit org settings." };
  }
  const parsed = updateOrgSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.organizationId !== session.activeOrganizationId) {
    return { ok: false as const, error: "Cross-org edit refused." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      org_type: parsed.data.orgType,
    })
    .eq("id", parsed.data.organizationId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false as const, error: `Slug "${parsed.data.slug}" is already in use.` };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/org/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

// ─────────── Org brand accent color ───────────
//
// Org admins can paint the UI in their brand color. The hex string is
// stored on `organizations.accent_color` (with a CHECK constraint
// keeping the format valid) and applied at the org-shell level via an
// inline CSS variable on the wrapper div. Members of the org see the
// custom accent everywhere; visitors and other-org users see the
// theme's baseline accent.

const setAccentSchema = z.object({
  organizationId: z.string().uuid(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex color like #2657ff")
    .nullable(),
});

export async function setOrgAccentColor(input: z.infer<typeof setAccentSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only org admins can change the brand color." };
  }
  const parsed = setAccentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.organizationId !== session.activeOrganizationId && !session.user.isSuperAdmin) {
    return { ok: false as const, error: "Cross-org edit refused." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ accent_color: parsed.data.accentColor })
    .eq("id", parsed.data.organizationId);
  if (error) return { ok: false as const, error: error.message };

  // Layout-wide revalidation so every member sees the new accent on next nav.
  revalidatePath("/", "layout");
  return { ok: true as const, accentColor: parsed.data.accentColor };
}

// ─────────── Member role + active state ───────────

const updateMemberSchema = z.object({
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(["org_admin", "instructor", "ta", "learner"]),
});

export async function updateMemberRole(input: z.infer<typeof updateMemberSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only org admins can change member roles." };
  }
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.organizationId !== session.activeOrganizationId) {
    return { ok: false as const, error: "Wrong organization." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("organization_members")
    .update({ role: parsed.data.role as UserRole })
    .eq("id", parsed.data.memberId)
    .eq("organization_id", parsed.data.organizationId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/org/members");
  revalidatePath("/seats");
  return { ok: true as const };
}

export async function deactivateMember(memberId: string, organizationId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only org admins can deactivate members." };
  }
  if (organizationId !== session.activeOrganizationId) {
    return { ok: false as const, error: "Wrong organization." };
  }

  const admin = createServiceRoleClient();

  // Refuse to deactivate the last active org_admin in this org — would orphan it.
  const { data: row } = await admin
    .from("organization_members")
    .select("user_id, role, is_active")
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .single();
  if (!row) return { ok: false as const, error: "Member not found." };
  if (row.role === "org_admin") {
    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "org_admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return {
        ok: false as const,
        error: "Can't deactivate the last active org admin. Promote someone else first.",
      };
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ is_active: false })
    .eq("id", memberId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/org/members");
  revalidatePath("/seats");
  return { ok: true as const };
}

export async function reactivateMember(memberId: string, organizationId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only org admins can reactivate members." };
  }
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("organization_members")
    .update({ is_active: true })
    .eq("id", memberId)
    .eq("organization_id", organizationId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/org/members");
  return { ok: true as const };
}
