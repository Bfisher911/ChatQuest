import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, Frame, Btn, Icon } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function OrgBillingPage() {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, plan_code")
    .eq("id", session.activeOrganizationId)
    .single();

  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, monthly_price_cents, instructor_seats, learner_seats, monthly_token_budget")
    .eq("scope", "organization")
    .order("display_order");

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <Eyebrow>BILLING</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        {(org?.name ?? "ORG").toUpperCase()}
      </h1>
      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>CURRENT PLAN</Eyebrow>
        <div className="cq-title-m" style={{ marginTop: 8 }}>
          {(org?.plan_code ?? "free").toUpperCase()}
        </div>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 8 }}>
          Stripe Checkout integration ships in Phase 3. Until then, super admins can change plan codes via
          /admin/orgs.
        </p>
      </Frame>

      <Eyebrow>AVAILABLE PLANS</Eyebrow>
      <div className="cq-grid cq-grid--2" style={{ marginTop: 12 }}>
        {(plans ?? []).map((p) => (
          <Frame key={p.code} style={{ padding: 20 }}>
            <div className="cq-title-m">{p.name}</div>
            <div className="cq-mono" style={{ fontSize: 13, marginTop: 8 }}>
              ${(p.monthly_price_cents ?? 0) / 100} / mo · {p.instructor_seats} instr · {p.learner_seats} lrn
            </div>
            <div style={{ marginTop: 12 }}>
              <Chip ghost>{p.code === org?.plan_code ? "ACTIVE" : "AVAILABLE"}</Chip>
            </div>
          </Frame>
        ))}
      </div>
    </div>
  );
}
