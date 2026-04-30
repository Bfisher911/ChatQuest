import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cassette, Chip, Eyebrow, Btn, Icon } from "@/components/brutalist";

// ISR — pricing is read from the plans table; revalidate every 5 min so plan
// edits propagate without forcing a server-side render on every request.
export const revalidate = 300;

// Reads via PostgREST (HTTPS) instead of direct Postgres so it works inside
// any deploy target — including Netlify Lambdas where outbound :5432 may be
// flaky. Plans are world-readable per RLS policy in 0009_policies.sql.
type PlanRow = {
  code: string;
  name: string;
  scope: string;
  monthly_price_cents: number | null;
  instructor_seats: number | null;
  learner_seats: number | null;
  monthly_token_budget: number | null;
};

export default async function PricingPage() {
  const supabase = createClient();
  const { data: all, error } = await supabase
    .from("plans")
    .select("code, name, scope, monthly_price_cents, instructor_seats, learner_seats, monthly_token_budget")
    .order("display_order", { ascending: true });
  if (error) {
    return (
      <div className="cq-page">
        <Eyebrow>PRICING</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 12 }}>
          PRICING UNAVAILABLE.
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
          {error.message}
        </p>
      </div>
    );
  }
  const rows = (all ?? []) as PlanRow[];
  const instructorPlans = rows.filter((p) => p.scope === "instructor");
  const orgPlans = rows.filter((p) => p.scope === "organization");

  return (
    <div className="cq-page" style={{ maxWidth: 1280 }}>
      <Eyebrow>PRICING</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        SIMPLE, BRUTAL, FAIR.
      </h1>

      <Eyebrow>FOR INSTRUCTORS</Eyebrow>
      <div className="cq-grid cq-grid--4" style={{ marginTop: 12, marginBottom: 32 }}>
        {instructorPlans.map((p, i) => (
          <Cassette key={p.code} small index={i + 1} indexWidth={4} title={p.name} meta={p.code.toUpperCase()} staticCard>
            <div className="cq-title-l" style={{ fontSize: 30, margin: "8px 0 12px" }}>
              ${(p.monthly_price_cents ?? 0) / 100}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}> /mo</span>
            </div>
            <div className="cq-mono" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div>{p.learner_seats} learner seats</div>
              <div>{((p.monthly_token_budget ?? 0) / 1000).toLocaleString()}K tokens / mo</div>
            </div>
            <div style={{ marginTop: "auto" }}>
              <Btn sm asChild>
                <Link href="/signup">CHOOSE</Link>
              </Btn>
            </div>
          </Cassette>
        ))}
      </div>

      <Eyebrow>FOR ORGANIZATIONS</Eyebrow>
      <div className="cq-grid cq-grid--4" style={{ marginTop: 12 }}>
        {orgPlans.map((p, i) => (
          <Cassette key={p.code} small index={i + 5} indexWidth={4} title={p.name} meta={p.code.toUpperCase()} staticCard>
            <div className="cq-title-l" style={{ fontSize: 28, margin: "8px 0 12px" }}>
              {p.code === "org_enterprise" ? "TALK TO US" : `$${(p.monthly_price_cents ?? 0) / 100}/mo`}
            </div>
            <div className="cq-mono" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div>{p.instructor_seats} instructor seats</div>
              <div>{p.learner_seats} learner seats</div>
            </div>
            <div style={{ marginTop: "auto" }}>
              <Btn sm asChild>
                <Link href="/signup">{p.code === "org_enterprise" ? "CONTACT" : "CHOOSE"}</Link>
              </Btn>
            </div>
          </Cassette>
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 24 }}>
        Phase 3 wires Stripe Checkout. Until then, plan upgrades simulate via the dev console.
      </p>
    </div>
  );
}
