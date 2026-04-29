import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { InstructorDashboard } from "./instructor";
import { LearnerDashboard } from "./learner";
import { OrgAdminDashboard } from "./org-admin";
import { SuperAdminDashboard } from "./super-admin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { user, activeRole, activeOrganizationId } = session;

  if (activeRole === "super_admin") {
    return <SuperAdminDashboard supabase={supabase} userName={user.displayName ?? user.fullName ?? user.email} />;
  }
  if (activeRole === "org_admin" && activeOrganizationId) {
    return (
      <OrgAdminDashboard
        supabase={supabase}
        userName={user.displayName ?? user.fullName ?? user.email}
        organizationId={activeOrganizationId}
      />
    );
  }
  if (activeRole === "learner") {
    return (
      <LearnerDashboard
        supabase={supabase}
        userId={user.id}
        userName={user.displayName ?? user.fullName ?? user.email}
      />
    );
  }
  return (
    <InstructorDashboard
      supabase={supabase}
      userId={user.id}
      userName={user.displayName ?? user.fullName ?? user.email}
      organizationId={activeOrganizationId}
    />
  );
}
