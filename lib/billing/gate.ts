// Plan-feature gating. Each helper takes the active plan code, returns a
// boolean (or a richer reason). Used by server actions before allowing
// gated actions (creating programs, adding nodes, generating certs, etc).

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PlanFeatures } from "@/lib/stripe/plans";

export interface PlanInfo {
  code: string;
  features: PlanFeatures;
  instructor_seats: number;
  learner_seats: number;
  monthly_token_budget: number;
}

const _planCache = new Map<string, PlanInfo>();

export async function getPlan(code: string): Promise<PlanInfo | null> {
  if (_planCache.has(code)) return _planCache.get(code)!;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("plans")
    .select("code, features, instructor_seats, learner_seats, monthly_token_budget")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  const info: PlanInfo = {
    code: data.code,
    features: (data.features as PlanFeatures) ?? {},
    instructor_seats: data.instructor_seats ?? 0,
    learner_seats: data.learner_seats ?? 0,
    monthly_token_budget: data.monthly_token_budget ?? 0,
  };
  _planCache.set(code, info);
  return info;
}

export async function getOrgPlan(organizationId: string): Promise<PlanInfo | null> {
  const admin = createServiceRoleClient();
  const { data: org } = await admin
    .from("organizations")
    .select("plan_code")
    .eq("id", organizationId)
    .maybeSingle();
  return getPlan(org?.plan_code ?? "free");
}

// ─────────── concrete gates ───────────

export async function canCreateProgram(
  organizationId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const plan = await getOrgPlan(organizationId);
  const cap = plan?.features.max_active_programs;
  if (!plan || cap === undefined) return { ok: true };

  const admin = createServiceRoleClient();
  const { count } = await admin
    .from("programs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "archived");
  if ((count ?? 0) >= cap) {
    return {
      ok: false,
      reason: `Plan "${plan.code}" allows ${cap} active programs. Upgrade or archive an existing program.`,
    };
  }
  return { ok: true };
}

export async function canCreateChatbotNode(
  organizationId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const plan = await getOrgPlan(organizationId);
  const cap = plan?.features.max_chat_nodes;
  if (!plan || cap === undefined) return { ok: true };

  const admin = createServiceRoleClient();
  const { count } = await admin
    .from("path_nodes")
    .select("id, programs!inner(organization_id)", { count: "exact", head: true })
    .eq("type", "bot")
    .eq("programs.organization_id", organizationId);
  if ((count ?? 0) >= cap) {
    return {
      ok: false,
      reason: `Plan "${plan.code}" allows ${cap} chatbot nodes across all programs.`,
    };
  }
  return { ok: true };
}

export async function canIssueCertificate(organizationId: string): Promise<boolean> {
  const plan = await getOrgPlan(organizationId);
  return plan?.features.certificates !== false;
}

export async function canSeatLearner(
  organizationId: string,
): Promise<{ ok: true; remaining: number } | { ok: false; reason: string }> {
  const plan = await getOrgPlan(organizationId);
  if (!plan) return { ok: false, reason: "No plan configured" };

  // Total active learners = distinct user_id where role=learner.
  const admin = createServiceRoleClient();
  const { count } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "learner")
    .eq("is_active", true);
  const used = count ?? 0;
  const remaining = plan.learner_seats - used;
  if (remaining <= 0) {
    return {
      ok: false,
      reason: `Learner seats exhausted (${used}/${plan.learner_seats}). Upgrade plan or remove an inactive learner.`,
    };
  }
  return { ok: true, remaining };
}

export async function canSeatInstructor(
  organizationId: string,
): Promise<{ ok: true; remaining: number } | { ok: false; reason: string }> {
  const plan = await getOrgPlan(organizationId);
  if (!plan) return { ok: false, reason: "No plan configured" };
  const admin = createServiceRoleClient();
  const { count } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("role", ["instructor", "ta"])
    .eq("is_active", true);
  const used = count ?? 0;
  const remaining = plan.instructor_seats - used;
  if (remaining <= 0) {
    return {
      ok: false,
      reason: `Instructor seats exhausted (${used}/${plan.instructor_seats}). Upgrade plan first.`,
    };
  }
  return { ok: true, remaining };
}

export async function allowedModelsForPlan(planCode: string): Promise<string[]> {
  // Free plans get cheap models only; paid plans get everything.
  const plan = await getPlan(planCode);
  if (!plan) return ["claude-haiku-4-5", "gpt-4o-mini", "gemini-2.5-flash"];
  if (planCode === "free") {
    return ["claude-haiku-4-5", "gpt-4o-mini", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  }
  if (planCode === "instr_basic") {
    return [
      "claude-haiku-4-5",
      "claude-3-5-haiku-latest",
      "gpt-4o-mini",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ];
  }
  // Pro / premium / org tiers — everything.
  return [
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];
}
