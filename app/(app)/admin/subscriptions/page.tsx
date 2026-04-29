import * as React from "react";
import { redirect } from "next/navigation";
import { Eyebrow, Chip } from "@/components/brutalist";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const session = await getActiveRole();
  if (!session?.user.isSuperAdmin) redirect("/dashboard");
  const supabase = createClient();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, organization_id, user_id, plan_code, status, current_period_end")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page">
      <Eyebrow>ADMIN · SUBSCRIPTIONS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        SUBSCRIPTIONS.
      </h1>
      <div className="cq-frame">
        <table className="cq-table">
          <thead>
            <tr>
              <th>PLAN</th>
              <th className="num">SCOPE</th>
              <th className="num">STATUS</th>
              <th className="num">RENEWS</th>
            </tr>
          </thead>
          <tbody>
            {(subs ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.plan_code}</td>
                <td className="num">{s.organization_id ? "ORG" : "USER"}</td>
                <td className="num">
                  <Chip ghost>{s.status.toUpperCase()}</Chip>
                </td>
                <td className="num">
                  {s.current_period_end ? new Date(s.current_period_end).toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
            {(!subs || subs.length === 0) && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No subscriptions yet — Phase 3 wires Stripe.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
