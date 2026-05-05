import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { getSessionUser } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/db/types";
import { getThemeFromCookies } from "@/lib/theme/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Allow user to override active role via cookie set by Header role switcher.
  const cookieRole = cookies().get("cq_role")?.value as UserRole | undefined;
  const allowed: UserRole[] = user.isSuperAdmin
    ? ["super_admin", "org_admin", "instructor", "ta", "learner"]
    : Array.from(new Set(user.memberships.map((m) => m.role)));
  const activeRole: UserRole = cookieRole && allowed.includes(cookieRole) ? cookieRole : user.activeRole;

  // Unread notification count for the bell badge.
  const supabase = createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  // Active org's brand-accent color (if set). Applied as an inline CSS
  // variable on the shell so it overrides the active theme's --accent
  // for everyone in this org. Falls back to the theme baseline when null.
  let orgAccent: string | null = null;
  if (user.activeOrganizationId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("accent_color")
      .eq("id", user.activeOrganizationId)
      .maybeSingle();
    orgAccent = (org?.accent_color as string | null) ?? null;
  }

  // Inline style only when an accent is set — keeps the DOM clean otherwise.
  const shellStyle = orgAccent
    ? ({ "--accent": orgAccent } as React.CSSProperties)
    : undefined;

  return (
    <div className="cq-shell" style={shellStyle}>
      <Header
        userEmail={user.email}
        displayName={user.displayName ?? user.fullName ?? user.email}
        activeRole={activeRole}
        memberships={user.memberships}
        isSuperAdmin={user.isSuperAdmin}
        unreadNotifications={unread ?? 0}
        initialTheme={getThemeFromCookies()}
      />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
