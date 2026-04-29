import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { getSessionUser } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/db/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Allow user to override active role via cookie set by Header role switcher.
  const cookieRole = cookies().get("cq_role")?.value as UserRole | undefined;
  const allowed: UserRole[] = user.isSuperAdmin
    ? ["super_admin", "org_admin", "instructor", "ta", "learner"]
    : Array.from(new Set(user.memberships.map((m) => m.role)));
  const activeRole: UserRole = cookieRole && allowed.includes(cookieRole) ? cookieRole : user.activeRole;

  return (
    <div className="cq-shell">
      <Header
        userEmail={user.email}
        displayName={user.displayName ?? user.fullName ?? user.email}
        activeRole={activeRole}
        memberships={user.memberships}
        isSuperAdmin={user.isSuperAdmin}
      />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
