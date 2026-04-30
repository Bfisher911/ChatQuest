// Soft + hard token-cap checks against the active plan's monthly budget.

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getOrgPlan } from "@/lib/billing/gate";

export interface UsageStatus {
  used: number;
  budget: number;
  percentage: number;
  state: "ok" | "warn" | "exceeded";
}

export async function getMonthlyTokenUsage(
  organizationId: string,
): Promise<UsageStatus> {
  const plan = await getOrgPlan(organizationId);
  const budget = plan?.monthly_token_budget ?? 0;
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("usage_logs")
    .select("prompt_tokens, completion_tokens")
    .eq("organization_id", organizationId)
    .gte("created_at", since.toISOString());

  const used = (data ?? []).reduce(
    (a, r) => a + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0),
    0,
  );
  const percentage = budget === 0 ? 0 : Math.round((used / budget) * 100);
  const state: UsageStatus["state"] =
    budget === 0 ? "ok" : percentage >= 100 ? "exceeded" : percentage >= 80 ? "warn" : "ok";
  return { used, budget, percentage, state };
}
