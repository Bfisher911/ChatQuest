import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Frame } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const session = await getActiveRole();
  if (!session?.user.isSuperAdmin) redirect("/dashboard");
  const supabase = createClient();
  const { data: usage } = await supabase
    .from("usage_logs")
    .select("created_at, kind, model, prompt_tokens, completion_tokens, est_cost_usd, organization_id")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="cq-page">
      <Eyebrow>ADMIN · USAGE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        TOKEN LEDGER.
      </h1>
      <Frame>
        <table className="cq-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th className="num">KIND</th>
              <th className="num">MODEL</th>
              <th className="num">PROMPT</th>
              <th className="num">COMPLETION</th>
              <th className="num">$</th>
            </tr>
          </thead>
          <tbody>
            {(usage ?? []).map((u, i) => (
              <tr key={i}>
                <td>{new Date(u.created_at).toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="num">{u.kind}</td>
                <td className="num">{u.model ?? "—"}</td>
                <td className="num">{u.prompt_tokens ?? 0}</td>
                <td className="num">{u.completion_tokens ?? 0}</td>
                <td className="num">{Number(u.est_cost_usd ?? 0).toFixed(4)}</td>
              </tr>
            ))}
            {(!usage || usage.length === 0) && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No usage yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Frame>
    </div>
  );
}
