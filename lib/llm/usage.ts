// Helper for writing usage_logs entries from server actions / route handlers.

import { createServiceRoleClient } from "@/lib/supabase/server";
import { estimateCostUsd } from "./cost";

export interface LogUsageInput {
  organizationId?: string | null;
  programId?: string | null;
  nodeId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  kind: "chat" | "embedding" | "grade_suggest";
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export async function logUsage(input: LogUsageInput): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const cost = estimateCostUsd(input.model, input.promptTokens, input.completionTokens);
    await admin.from("usage_logs").insert({
      organization_id: input.organizationId ?? null,
      program_id: input.programId ?? null,
      node_id: input.nodeId ?? null,
      conversation_id: input.conversationId ?? null,
      user_id: input.userId ?? null,
      kind: input.kind,
      model: input.model,
      prompt_tokens: input.promptTokens,
      completion_tokens: input.completionTokens,
      est_cost_usd: cost,
    });
  } catch (err) {
    // Don't break the main request path on telemetry failure.
    console.error("[usage] failed to log:", err);
  }
}
