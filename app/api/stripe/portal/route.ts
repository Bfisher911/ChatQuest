// Open the Stripe Customer Portal for the active org / user.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { stripe, isStripeConfigured } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
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
    .select("stripe_customer_id, name")
    .eq("id", m.organization_id)
    .single();
  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer for this org yet." }, { status: 400 });
  }

  const portal = await stripe().billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/org/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
