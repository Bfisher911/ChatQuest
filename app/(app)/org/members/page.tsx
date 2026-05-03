import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, Btn, Icon } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";
import { MemberRow } from "./member-row";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage() {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  const supabase = createClient();
  const orgId = session.activeOrganizationId;

  const canEdit =
    session.activeRole === "org_admin" || session.user.isSuperAdmin;

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, role, joined_at, is_active, user:users(id, email, full_name, display_name)")
    .eq("organization_id", orgId)
    .order("is_active", { ascending: false })
    .order("joined_at", { ascending: false });

  type Row = {
    id: string;
    role: string;
    joined_at: string;
    is_active: boolean;
    user: { id: string; email: string; full_name: string | null; display_name: string | null } | null;
  };
  const rows = (members ?? []) as unknown as Row[];

  const active = rows.filter((r) => r.is_active);
  const inactive = rows.filter((r) => !r.is_active);

  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Btn sm ghost asChild>
          <Link href="/org/settings">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> ORG SETTINGS
          </Link>
        </Btn>
        <Chip ghost>{active.length} ACTIVE</Chip>
        {inactive.length > 0 ? <Chip ghost>{inactive.length} INACTIVE</Chip> : null}
      </div>
      <Eyebrow>MEMBERS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        ORGANIZATION MEMBERS.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        {canEdit
          ? "Promote / demote roles or deactivate members. The last active org admin can't be deactivated."
          : "View-only — only org admins can edit roles or deactivate members."}
      </p>

      <div className="cq-frame">
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">ROLE</th>
              <th className="num">JOINED</th>
              {canEdit ? <th className="num">ACTIONS</th> : null}
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 5 : 4} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No active members.
                </td>
              </tr>
            ) : (
              active.map((m) => (
                <MemberRow
                  key={m.id}
                  organizationId={orgId}
                  member={{
                    id: m.id,
                    role: m.role as "org_admin" | "instructor" | "ta" | "learner",
                    joinedAt: m.joined_at,
                    isActive: m.is_active,
                    name: m.user?.display_name ?? m.user?.full_name ?? "—",
                    email: m.user?.email ?? "—",
                    isSelf: m.user?.id === session.user.id,
                  }}
                  canEdit={canEdit}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {inactive.length > 0 ? (
        <>
          <div style={{ marginTop: 24 }}>
            <Eyebrow>INACTIVE · {inactive.length}</Eyebrow>
          </div>
          <div className="cq-frame" style={{ marginTop: 12 }}>
            <table className="cq-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th className="num">ROLE</th>
                  <th className="num">JOINED</th>
                  {canEdit ? <th className="num">ACTIONS</th> : null}
                </tr>
              </thead>
              <tbody>
                {inactive.map((m) => (
                  <MemberRow
                    key={m.id}
                    organizationId={orgId}
                    member={{
                      id: m.id,
                      role: m.role as "org_admin" | "instructor" | "ta" | "learner",
                      joinedAt: m.joined_at,
                      isActive: m.is_active,
                      name: m.user?.display_name ?? m.user?.full_name ?? "—",
                      email: m.user?.email ?? "—",
                      isSelf: m.user?.id === session.user.id,
                    }}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
