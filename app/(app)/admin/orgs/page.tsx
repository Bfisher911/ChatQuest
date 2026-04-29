import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage() {
  const session = await getActiveRole();
  if (!session?.user.isSuperAdmin) redirect("/dashboard");
  const supabase = createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, plan_code, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page">
      <Eyebrow>ADMIN · ORGS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        ALL ORGANIZATIONS.
      </h1>
      <div className="cq-frame">
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>SLUG</th>
              <th className="num">PLAN</th>
              <th className="num">ACTIVE</th>
              <th className="num">CREATED</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.slug}</td>
                <td className="num">
                  <Chip ghost>{(o.plan_code ?? "free").toUpperCase()}</Chip>
                </td>
                <td className="num">{o.is_active ? "YES" : "NO"}</td>
                <td className="num">{new Date(o.created_at).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
