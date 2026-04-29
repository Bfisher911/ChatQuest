import * as React from "react";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import { Cassette, Chip, Eyebrow, Btn, Icon } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const conn = db();
  const all = await conn.select().from(plans);
  const instructorPlans = all.filter((p) => p.scope === "instructor");
  const orgPlans = all.filter((p) => p.scope === "organization");

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
              ${(p.monthlyPriceCents ?? 0) / 100}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}> /mo</span>
            </div>
            <div className="cq-mono" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div>{p.learnerSeats} learner seats</div>
              <div>{((p.monthlyTokenBudget ?? 0) / 1000).toLocaleString()}K tokens / mo</div>
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
              {p.code === "org_enterprise" ? "TALK TO US" : `$${(p.monthlyPriceCents ?? 0) / 100}/mo`}
            </div>
            <div className="cq-mono" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div>{p.instructorSeats} instructor seats</div>
              <div>{p.learnerSeats} learner seats</div>
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
