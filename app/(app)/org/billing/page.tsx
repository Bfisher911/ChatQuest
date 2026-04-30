import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Frame, Btn } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";
import { CheckoutButton } from "./checkout-button";
import { isStripeConfigured } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

export default async function OrgBillingPage() {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, plan_code, stripe_customer_id")
    .eq("id", session.activeOrganizationId)
    .single();

  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, monthly_price_cents, instructor_seats, learner_seats, monthly_token_budget, features")
    .eq("scope", "organization")
    .order("display_order");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, plan_code")
    .eq("organization_id", session.activeOrganizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stripeReady = isStripeConfigured();

  return (
    <div className="cq-page" style={{ maxWidth: 980 }}>
      <Eyebrow>BILLING</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        {(org?.name ?? "ORG").toUpperCase()}
      </h1>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>CURRENT PLAN</Eyebrow>
        <div className="cq-title-m" style={{ marginTop: 8 }}>
          {(org?.plan_code ?? "free").toUpperCase()}
        </div>
        {sub ? (
          <div className="cq-mono" style={{ fontSize: 12, marginTop: 8, color: "var(--muted)" }}>
            STATUS · {sub.status.toUpperCase()}
            {sub.current_period_end ? ` · RENEWS ${new Date(sub.current_period_end).toISOString().slice(0, 10)}` : ""}
            {sub.cancel_at_period_end ? " · WILL CANCEL AT PERIOD END" : ""}
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 8 }}>
            No active subscription. Pick a plan below to upgrade.
          </p>
        )}
        {!stripeReady ? (
          <div className="cq-form-error" style={{ marginTop: 16 }}>
            Stripe isn&apos;t fully configured. Set STRIPE_SECRET_KEY,
            STRIPE_WEBHOOK_SECRET, and the per-plan price env vars on Netlify.
          </div>
        ) : org?.stripe_customer_id ? (
          <div style={{ marginTop: 16 }}>
            <CheckoutButton portalMode>MANAGE BILLING</CheckoutButton>
          </div>
        ) : null}
      </Frame>

      <Eyebrow>AVAILABLE PLANS</Eyebrow>
      <div className="cq-grid cq-grid--2" style={{ marginTop: 12 }}>
        {(plans ?? []).map((p) => {
          const isCurrent = p.code === org?.plan_code;
          const isContact = p.code === "org_enterprise";
          return (
            <Frame key={p.code} style={{ padding: 20 }}>
              <div className="cq-title-m">{p.name}</div>
              <div className="cq-mono" style={{ fontSize: 13, marginTop: 8, marginBottom: 12 }}>
                ${(p.monthly_price_cents ?? 0) / 100} / mo · {p.instructor_seats} instr ·{" "}
                {p.learner_seats} lrn ·{" "}
                {((p.monthly_token_budget ?? 0) / 1000).toLocaleString()}K tokens
              </div>
              {isCurrent ? (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>■ CURRENT</div>
              ) : isContact ? (
                <Btn sm asChild>
                  <a href="mailto:sales@chatquest.app">CONTACT SALES</a>
                </Btn>
              ) : stripeReady ? (
                <CheckoutButton planCode={p.code} scope="org">
                  {sub ? "SWITCH PLAN" : "UPGRADE"}
                </CheckoutButton>
              ) : (
                <Btn sm ghost disabled>STRIPE NOT CONFIGURED</Btn>
              )}
            </Frame>
          );
        })}
      </div>
    </div>
  );
}
