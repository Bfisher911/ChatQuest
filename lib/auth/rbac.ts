// Role-based access control helpers. Server-side only.

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/db/types";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  displayName: string | null;
  isSuperAdmin: boolean;
  memberships: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: UserRole;
  }[];
  // The role we're rendering the UI as. Defaults to the highest privilege
  // membership; can be overridden by ?as= query in the role switcher (Phase 1
  // dev affordance — removed when SSO + assigned roles are real in Phase 3).
  activeRole: UserRole;
  activeOrganizationId: string | null;
}

/**
 * Returns the currently authenticated user's profile + memberships, or null
 * if not signed in. Cached per request via React.cache.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, display_name, is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select(
      "role, organization:organizations(id, name, slug)",
    )
    .eq("user_id", user.id)
    .eq("is_active", true);

  type MembershipRow = { role: UserRole; organization: { id: string; name: string; slug: string } | null };
  const mems = ((memberships ?? []) as unknown as MembershipRow[]).map((m) => ({
    organizationId: m.organization?.id ?? "",
    organizationName: m.organization?.name ?? "",
    organizationSlug: m.organization?.slug ?? "",
    role: m.role,
  }));

  // Default active role: super_admin > org_admin > instructor > ta > learner.
  const priority: UserRole[] = ["super_admin", "org_admin", "instructor", "ta", "learner"];
  let activeRole: UserRole = "learner";
  if (profile.is_super_admin) activeRole = "super_admin";
  else {
    for (const r of priority) {
      if (mems.some((m) => m.role === r)) {
        activeRole = r;
        break;
      }
    }
  }
  const activeOrganizationId =
    activeRole === "super_admin" ? null : mems.find((m) => m.role === activeRole)?.organizationId ?? null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    displayName: profile.display_name,
    isSuperAdmin: profile.is_super_admin,
    memberships: mems,
    activeRole,
    activeOrganizationId,
  };
});

/**
 * Server-only: ensures the caller is authenticated. Redirects to /login otherwise.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Server-only: requires the caller hold one of the given roles in any of their
 * orgs (super admin always passes). Redirects to /dashboard if the role is missing.
 */
export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.isSuperAdmin) return user;
  const ok = user.memberships.some((m) => roles.includes(m.role));
  if (!ok) redirect("/dashboard");
  return user;
}

/** True if the user can grade in this program (instructor, TA, super admin). */
export function canGrade(user: SessionUser, organizationId: string) {
  if (user.isSuperAdmin) return true;
  return user.memberships.some(
    (m) => m.organizationId === organizationId && (m.role === "instructor" || m.role === "ta"),
  );
}

/** True if the user can edit a program (instructor, org admin, super admin). */
export function canEditProgram(user: SessionUser, organizationId: string) {
  if (user.isSuperAdmin) return true;
  return user.memberships.some(
    (m) =>
      m.organizationId === organizationId &&
      (m.role === "instructor" || m.role === "org_admin"),
  );
}
