// Server-only Stripe client. The secret key never reaches the browser.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  _stripe = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: { name: "ChatQuest", version: "0.1.0" },
  });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}
