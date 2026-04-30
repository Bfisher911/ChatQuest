// Plan code → Stripe price id mapping.
//
// Pasted from Stripe dashboard once you create products + prices for each plan.
// Set the env vars below on Netlify, OR override per-plan via PLAN_PRICE_<CODE>.
//
// NOTE: only "instructor" and "organization" scope plans are billable here.
// "free" plan never goes through Checkout. "org_enterprise" is "contact sales".

export const PLAN_PRICE_ENV_VARS: Record<string, string> = {
  instr_basic: "STRIPE_PRICE_INSTR_BASIC",
  instr_pro: "STRIPE_PRICE_INSTR_PRO",
  instr_premium: "STRIPE_PRICE_INSTR_PREMIUM",
  org_starter: "STRIPE_PRICE_ORG_STARTER",
  org_dept: "STRIPE_PRICE_ORG_DEPT",
  org_school: "STRIPE_PRICE_ORG_SCHOOL",
};

export function priceIdForPlan(planCode: string): string | null {
  const envVar = PLAN_PRICE_ENV_VARS[planCode];
  if (!envVar) return null;
  return process.env[envVar] ?? null;
}

export interface PlanFeatures {
  max_active_programs?: number;
  max_chat_nodes?: number;
  certificates?: boolean;
  sso?: boolean;
  contact_sales?: boolean;
  custom_seats?: boolean;
}

export type PlanScope = "instructor" | "organization" | "learner_per_program";
