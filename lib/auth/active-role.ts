// Read the user's currently-active role honoring the cq_role cookie override.

import { cookies } from "next/headers";
import { getSessionUser, type SessionUser } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/db/types";

export async function getActiveRole(): Promise<{ user: SessionUser; activeRole: UserRole; activeOrganizationId: string | null } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const cookieRole = cookies().get("cq_role")?.value as UserRole | undefined;
  const allowed: UserRole[] = user.isSuperAdmin
    ? ["super_admin", "org_admin", "instructor", "ta", "learner"]
    : Array.from(new Set(user.memberships.map((m) => m.role)));
  const activeRole: UserRole = cookieRole && allowed.includes(cookieRole) ? cookieRole : user.activeRole;
  const activeOrganizationId =
    activeRole === "super_admin"
      ? null
      : user.memberships.find((m) => m.role === activeRole)?.organizationId ?? user.activeOrganizationId;
  return { user, activeRole, activeOrganizationId };
}
