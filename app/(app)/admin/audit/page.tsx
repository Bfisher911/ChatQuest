import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, Frame } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { action?: string; actor?: string };
}) {
  const session = await getActiveRole();
  if (!session?.user.isSuperAdmin) redirect("/dashboard");

  const supabase = createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, created_at, action, target_type, target_id, actor_user_id, organization_id, metadata, ip_address",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (searchParams.action) query = query.ilike("action", `%${searchParams.action}%`);
  if (searchParams.actor) query = query.eq("actor_user_id", searchParams.actor);
  const { data: rows } = await query;

  return (
    <div className="cq-page">
      <Eyebrow>ADMIN · AUDIT LOG</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        AUDIT LOG.
      </h1>

      <Frame style={{ padding: 16, marginBottom: 16 }}>
        <form method="get" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="cq-field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label htmlFor="action">Action contains</label>
            <input
              id="action"
              name="action"
              defaultValue={searchParams.action ?? ""}
              className="cq-input"
              placeholder="grade.save"
            />
          </div>
          <div className="cq-field" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
            <label htmlFor="actor">Actor user id</label>
            <input id="actor" name="actor" defaultValue={searchParams.actor ?? ""} className="cq-input" />
          </div>
          <button type="submit" className="cq-btn cq-btn--sm">
            FILTER
          </button>
        </form>
      </Frame>

      <Frame>
        <table className="cq-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th>ACTION</th>
              <th>TARGET</th>
              <th>ACTOR</th>
              <th>ORG</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}</td>
                <td><Chip ghost>{r.action}</Chip></td>
                <td>{r.target_type ?? "—"} · {r.target_id?.slice(0, 8) ?? "—"}</td>
                <td>{r.actor_user_id?.slice(0, 8) ?? "—"}</td>
                <td>{r.organization_id?.slice(0, 8) ?? "—"}</td>
                <td>{r.ip_address ?? "—"}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No audit entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Frame>
    </div>
  );
}
