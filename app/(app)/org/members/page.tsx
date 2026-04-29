import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage() {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  const supabase = createClient();
  const { data: members } = await supabase
    .from("organization_members")
    .select("role, user:users(id, email, full_name, display_name), joined_at")
    .eq("organization_id", session.activeOrganizationId)
    .eq("is_active", true);
  type Row = { role: string; joined_at: string; user: { id: string; email: string; full_name: string | null; display_name: string | null } | null };
  const rows = (members ?? []) as unknown as Row[];

  return (
    <div className="cq-page" style={{ maxWidth: 1000 }}>
      <Eyebrow>MEMBERS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        ORGANIZATION MEMBERS.
      </h1>
      <div className="cq-frame">
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">ROLE</th>
              <th className="num">JOINED</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>No members.</td>
              </tr>
            ) : (
              rows.map((m, i) => (
                <tr key={i}>
                  <td>{m.user?.display_name ?? m.user?.full_name ?? "—"}</td>
                  <td>{m.user?.email ?? "—"}</td>
                  <td className="num">
                    <Chip ghost>{m.role.toUpperCase()}</Chip>
                  </td>
                  <td className="num">{new Date(m.joined_at).toISOString().slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
