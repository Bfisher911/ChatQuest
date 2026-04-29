// Per-million-token costs in USD. Update as pricing changes.
// Used for est_cost_usd in usage_logs — informative, not billable.

const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  // Embeddings (per 1M tokens)
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const c = COST_PER_M_TOKENS[model];
  if (!c) return 0;
  return (
    (promptTokens / 1_000_000) * c.input + (completionTokens / 1_000_000) * c.output
  );
}
