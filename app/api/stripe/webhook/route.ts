// Stripe webhook handler. Verifies signature, writes a billing_events row
// (durable audit log), and updates subscriptions / programs / org plan_code.
//
// Set STRIPE_WEBHOOK_SECRET to the value Stripe gives you for this endpoint.

import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const buf = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Audit row first, idempotently keyed on the Stripe event id.
  const { error: insertErr } = await admin.from("billing_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    organization_id: extractOrgId(event),
    user_id: extractUserId(event),
  });
  // Replays are fine — unique violation on stripe_event_id means we already processed.
  if (insertErr && !insertErr.message?.includes("duplicate")) {
    console.error("[stripe] billing_events insert failed:", insertErr.message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session, admin);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object as Stripe.Subscription, admin);
        break;
      case "customer.subscription.deleted":
        await markSubCanceled(event.data.object as Stripe.Subscription, admin);
        break;
      case "invoice.payment_failed":
        await markPaymentFailed(event.data.object as Stripe.Invoice, admin);
        break;
      default:
        // ignored
        break;
    }
  } catch (err) {
    console.error(`[stripe] handler for ${event.type} failed:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  await admin
    .from("billing_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);

  return NextResponse.json({ received: true });
}

function extractOrgId(event: Stripe.Event): string | null {
  const obj = event.data.object as { metadata?: Record<string, string> };
  return obj.metadata?.organization_id ?? null;
}
function extractUserId(event: Stripe.Event): string | null {
  const obj = event.data.object as { metadata?: Record<string, string>; client_reference_id?: string };
  return obj.metadata?.user_id ?? obj.client_reference_id ?? null;
}

type Admin = ReturnType<typeof createServiceRoleClient>;

async function handleCheckoutComplete(session: Stripe.Checkout.Session, admin: Admin) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.kind === "program_enrollment" && meta.program_id && meta.learner_id) {
    await admin.from("program_enrollments").upsert(
      {
        program_id: meta.program_id,
        user_id: meta.learner_id,
        status: "active",
      },
      { onConflict: "program_id,user_id" },
    );
  }
  // For subscription mode, the subsequent customer.subscription.created event
  // does the heavy lifting via syncSubscription.
}

async function syncSubscription(sub: Stripe.Subscription, admin: Admin) {
  const meta = (sub.metadata ?? {}) as Record<string, string>;
  const orgId = meta.organization_id ?? null;
  const userId = meta.user_id ?? null;
  const planCode = meta.plan_code ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await admin.from("subscriptions").upsert(
    {
      organization_id: orgId,
      user_id: userId,
      plan_code: planCode ?? "free",
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | "paused",
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Mirror plan_code on the org for fast read paths.
  if (orgId && planCode) {
    await admin.from("organizations").update({ plan_code: planCode }).eq("id", orgId);
  }
}

async function markSubCanceled(sub: Stripe.Subscription, admin: Admin) {
  await admin
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: true })
    .eq("stripe_subscription_id", sub.id);
  // Drop the org back to "free" so feature gates kick in.
  const meta = (sub.metadata ?? {}) as Record<string, string>;
  if (meta.organization_id) {
    await admin.from("organizations").update({ plan_code: "free" }).eq("id", meta.organization_id);
  }
}

async function markPaymentFailed(invoice: Stripe.Invoice, admin: Admin) {
  if (!invoice.subscription) return;
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
  await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);
}
