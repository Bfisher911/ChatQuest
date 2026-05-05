// Translate raw LLM provider errors into messages a user / admin can act on.
//
// The Anthropic / OpenAI / Gemini SDKs throw error messages that range from
// helpful ("Invalid API key") to opaque ("400 status error"). We wrap them
// into clear "this is what's wrong, this is what to do" strings so:
//   - Learners chatting see something useful instead of "Stream error"
//   - Creators previewing a bot get pointed at the right env var
//   - Org admins know whether the issue is config (their fault) or
//     provider outage (not their fault)
//
// This is intentionally conservative — when we don't recognize the error
// shape, return the raw message rather than guessing.

export function friendlyLLMError(raw: string): string {
  const m = (raw ?? "").toLowerCase();

  // Missing-key errors thrown by lib/llm/provider.ts
  if (m.includes("anthropic_api_key is not set")) {
    return "Anthropic isn't configured on this deployment. Ask your admin to set ANTHROPIC_API_KEY in the hosting env vars and redeploy.";
  }
  if (m.includes("openai_api_key is not set")) {
    return "OpenAI isn't configured on this deployment. Ask your admin to set OPENAI_API_KEY in the hosting env vars and redeploy.";
  }
  if (m.includes("gemini_api_key") && m.includes("not set")) {
    return "Gemini isn't configured on this deployment. Ask your admin to set GEMINI_API_KEY in the hosting env vars and redeploy.";
  }

  // Provider-side authentication failures (key set but invalid).
  if (
    m.includes("invalid api key") ||
    m.includes("incorrect api key") ||
    m.includes("authentication") && (m.includes("invalid") || m.includes("failed")) ||
    /\b401\b/.test(m) ||
    m.includes("unauthorized")
  ) {
    return "AI provider rejected the API key. The key is set but invalid, expired, or for the wrong account. Ask your admin to verify it.";
  }

  // Rate / quota errors.
  if (m.includes("rate limit") || /\b429\b/.test(m)) {
    return "AI provider rate-limited this request. Wait a moment and try again. If it keeps happening, the org may need a higher provider tier.";
  }
  if (m.includes("quota") || m.includes("billing")) {
    return "AI provider says the account is out of credits or has a billing issue. Ask your admin to check the provider dashboard.";
  }

  // Provider outages / 5xx.
  if (/\b5\d\d\b/.test(m) || m.includes("overloaded") || m.includes("server error") || m.includes("service unavailable")) {
    return "AI provider is having issues right now (5xx response). Try again in a minute. If it persists, check the provider's status page.";
  }

  // Network / DNS / connection issues — common in dev or behind picky firewalls.
  if (m.includes("econnreset") || m.includes("etimedout") || m.includes("enotfound") || m.includes("network")) {
    return "Couldn't reach the AI provider over the network. Check the deployment's outbound connectivity (firewall, VPC).";
  }

  // Model-not-available (e.g., a Claude model the API account doesn't have access to).
  if (m.includes("model") && (m.includes("not found") || m.includes("not available") || m.includes("does not exist"))) {
    return "The bot's model isn't available on the provider account. Switch to a different model in the bot inspector, or ask your admin to enable it on the provider.";
  }

  // Token / context-length errors.
  if (m.includes("context") && m.includes("length") || m.includes("too many tokens") || m.includes("max_tokens")) {
    return "The conversation is too long for this model. Try a model with a larger context window, or shorten the system prompt / KB chunks.";
  }

  // Fall back to the raw message — preserve detail when we can't classify.
  return raw || "Unknown LLM error";
}
