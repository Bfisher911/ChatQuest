import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getActiveRole();
  if (!session?.user.isSuperAdmin) redirect("/dashboard");
  const supabase = createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, display_name, is_super_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="cq-page">
      <Eyebrow>ADMIN · USERS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        ALL USERS.
      </h1>
      <div className="cq-frame">
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">ROLE</th>
              <th className="num">CREATED</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.display_name ?? u.full_name ?? "—"}</td>
                <td>{u.email}</td>
                <td className="num">
                  {u.is_super_admin ? <Chip>SUPER</Chip> : <Chip ghost>USER</Chip>}
                </td>
                <td className="num">{new Date(u.created_at).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
