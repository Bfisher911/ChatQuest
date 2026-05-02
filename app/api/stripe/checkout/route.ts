// Create a Stripe Checkout session for plan upgrade.
//
// Three flows:
//   1. Org admin upgrades the org's plan       → mode=subscription, scope=org
//   2. Instructor upgrades their personal plan → mode=subscription, scope=user
//   3. Learner pays for a single program       → mode=payment, scope=program
//
// Caller passes `?planCode=...` (org/instructor) or `?programId=...` (learner-paid).
// Webhook (./webhook/route.ts) finalizes the subscription record.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { stripe, isStripeConfigured } from "@/lib/stripe/server";
import { priceIdForPlan } from "@/lib/stripe/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reqSchema = z.object({
  planCode: z.string().optional(),
  programId: z.string().uuid().optional(),
  scope: z.enum(["org", "user", "program"]).default("org"),
});

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
      { status: 501 },
    );
  }
  const body = await req.json();
  const parsed = reqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (parsed.data.scope === "program" && parsed.data.programId) {
    // Learner pays for a single program.
    const { data: program } = await admin
      .from("programs")
      .select("id, title, learner_pays, learner_price_cents, organization_id")
      .eq("id", parsed.data.programId)
      .maybeSingle();
    if (!program?.learner_pays || !program.learner_price_cents) {
      return NextResponse.json({ error: "Program is not learner-paid." }, { status: 400 });
    }
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: program.learner_price_cents,
            product_data: {
              name: program.title,
              description: `Chatrail enrollment — ${program.title}`,
            },
          },
        },
      ],
      success_url: `${appUrl}/learn/${program.id}?checkout=success`,
      cancel_url: `${appUrl}/learn/${program.id}?checkout=cancel`,
      client_reference_id: user.id,
      metadata: {
        kind: "program_enrollment",
        program_id: program.id,
        learner_id: user.id,
        organization_id: program.organization_id,
      },
    });
    return NextResponse.json({ url: session.url });
  }

  if (!parsed.data.planCode) {
    return NextResponse.json({ error: "planCode required" }, { status: 400 });
  }
  const priceId = priceIdForPlan(parsed.data.planCode);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for plan "${parsed.data.planCode}". Set the matching env var.` },
      { status: 400 },
    );
  }

  let customerId: string | null = null;
  let metadata: Record<string, string> = {};
  let successUrl = `${appUrl}/dashboard?checkout=success`;
  let cancelUrl = `${appUrl}/dashboard?checkout=cancel`;

  if (parsed.data.scope === "org") {
    // Find caller's primary org-admin org.
    const { data: m } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "org_admin")
      .eq("is_active", true)
      .maybeSingle();
    if (!m) return NextResponse.json({ error: "Not an org admin." }, { status: 403 });

    const { data: org } = await admin
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", m.organization_id)
      .single();
    if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe().customers.create({
        name: org.name,
        metadata: { organization_id: org.id },
      });
      customerId = customer.id;
      await admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
    }
    metadata = {
      kind: "org_subscription",
      organization_id: org.id,
      plan_code: parsed.data.planCode,
    };
    successUrl = `${appUrl}/org/billing?checkout=success`;
    cancelUrl = `${appUrl}/org/billing?checkout=cancel`;
  } else {
    // Instructor personal subscription.
    metadata = {
      kind: "user_subscription",
      user_id: user.id,
      plan_code: parsed.data.planCode,
    };
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    metadata,
    subscription_data: { metadata },
  });

  return NextResponse.json({ url: session.url });
}
