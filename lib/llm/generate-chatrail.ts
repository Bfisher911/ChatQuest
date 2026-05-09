// AI-assisted Chatrail generator.
//
// Takes a natural-language description from a creator and returns a fully-
// validated plan with multiple bot nodes, learner-facing instructions,
// system prompts, and a linear edge sequence connecting them. Used by the
// /programs/generate flow.
//
// Strategy: ask Claude (via the provider abstraction so OpenAI / Gemini
// also work) for structured JSON. We prefill a `{` to anchor JSON-mode
// behavior in models without native JSON mode, then parse + Zod-validate.
// On parse failure we retry once with the validation error appended so the
// model can self-correct.

import { z } from "zod";
import { completeChat, type ChatModel, type ChatMessage } from "./provider";

export const NODE_TYPES = ["bot", "content", "milestone", "cert"] as const;

export const generatedNodeSchema = z.object({
  title: z.string().min(2).max(80),
  type: z.enum(NODE_TYPES).default("bot"),
  /** Short briefing the learner sees in the chat header. 1–3 sentences. */
  learnerInstructions: z.string().min(10).max(800),
  /**
   * The bot's system prompt. Should be a fully-formed character / persona /
   * pedagogy directive — what role it plays, what it must do each turn,
   * how it ends. Required for type="bot"; ignored otherwise.
   */
  systemPrompt: z.string().min(20).max(4000).optional().nullable(),
  /**
   * Body content for type="content" nodes. Plain markdown. Required for
   * type="content"; ignored otherwise.
   */
  bodyMarkdown: z.string().min(10).max(8000).optional().nullable(),
  points: z.coerce.number().int().min(0).max(500).default(25),
  /** Per-attempt token budget for bot nodes. */
  tokenBudget: z.coerce.number().int().min(1000).max(64000).default(8000),
  /** Max tokens per assistant turn for bot nodes. */
  maxTokens: z.coerce.number().int().min(128).max(8000).default(1024),
  attemptsAllowed: z.coerce.number().int().min(1).max(5).default(2),
  temperature: z.coerce.number().min(0).max(1).default(0.4),
});

export const generatedPlanSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(800),
  /** Default model for any bot whose `model` field isn't set. */
  defaultModel: z
    .enum([
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-mini",
      "gpt-4.1",
      "gemini-3-pro",
      "gemini-3-flash",
      "gemini-3-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ])
    .default("claude-haiku-4-5"),
  nodes: z.array(generatedNodeSchema).min(1).max(12),
});

export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
export type GeneratedNode = z.infer<typeof generatedNodeSchema>;

const SYSTEM_PROMPT = `You are a curriculum designer for ChatQuest, a chatbot-native LMS where each learning unit is a chatbot conversation. Your job: turn a creator's brief into a complete, ready-to-launch Chatrail plan.

A Chatrail is an ordered sequence of nodes. Most nodes are bot conversations where a learner chats with an AI tutor / role-play partner / examiner / coach. Some nodes are content readings or milestones.

For each BOT node you must produce:
- A specific persona and pedagogical stance for the bot (Socratic tutor / debate opponent / patient simulator / interview coach / etc.)
- A system prompt that:
  - Establishes the persona in the second sentence
  - States 2–4 explicit conversational rules ("do this each turn", "never do that", "ask one question at a time")
  - Specifies a clear ending condition ("after 6 substantive learner responses, summarize and end")
  - Tells the bot to stay in role no matter what the learner says
- Learner-facing instructions: a 1–3 sentence briefing the learner reads BEFORE chatting. Tells them their goal, not the bot's mechanics.

DESIGN PRINCIPLES:
- Sequence matters. Earlier nodes should set context for later ones.
- Mix bot styles — don't make every node Socratic. Vary: explainer, examiner, role-play partner, debater, reflective coach, simulation, peer, expert.
- Vary cognitive level: comprehension → application → analysis → synthesis → evaluation.
- 3–7 nodes is the sweet spot for a Chatrail. Don't pad with weak nodes.
- A "milestone" node is a checkpoint that requires hitting prereqs; use it sparingly (zero or one per Chatrail).
- A "content" node is a static reading + ack; use it when you need to expose source material that doesn't fit a chat.
- Default to all-bot Chatrails unless the brief obviously calls for content / milestones.
- token_budget: 6000 for short bots, 10000 for deep ones, 16000 for long simulations
- temperature: 0.3 for Socratic / examiner / coding / law, 0.6 for role-play / creative / debate, 0.5 default
- attempts_allowed: 2 for normal, 1 for high-stakes assessment, 3 for skill drills

OUTPUT FORMAT:
Return ONLY a JSON object matching this exact shape — no prose, no markdown fences:

{
  "title": "Title under 120 chars",
  "description": "1–2 sentence learner-facing description",
  "defaultModel": "claude-haiku-4-5" | "claude-sonnet-4-6" | "claude-3-5-sonnet-latest" | "claude-3-5-haiku-latest" | "gpt-4o" | "gpt-4o-mini" | "gpt-4.1" | "gpt-4.1-mini" | "gemini-3-pro" | "gemini-3-flash" | "gemini-3-flash-lite" | "gemini-2.5-pro" | "gemini-2.5-flash" | "gemini-2.5-flash-lite",
  "nodes": [
    {
      "title": "Node title",
      "type": "bot" | "content" | "milestone" | "cert",
      "learnerInstructions": "What the learner should do",
      "systemPrompt": "Bot persona + rules + ending (REQUIRED for type=bot, omit otherwise)",
      "bodyMarkdown": "Markdown content (REQUIRED for type=content, omit otherwise)",
      "points": 25,
      "tokenBudget": 8000,
      "maxTokens": 1024,
      "attemptsAllowed": 2,
      "temperature": 0.4
    }
  ]
}

Pick defaultModel claude-haiku-4-5 for cost-sensitive cohorts, claude-sonnet-4-6 for higher-stakes work. Use Sonnet only when the bots need real depth.`;

/**
 * Generate a validated Chatrail plan from a natural-language prompt.
 *
 * @throws if the model returns invalid JSON or the plan fails schema validation
 *         after one self-correction retry.
 */
export async function generateChatrailPlan({
  prompt,
  model = "claude-sonnet-4-6",
  maxNodes = 7,
}: {
  prompt: string;
  model?: ChatModel;
  maxNodes?: number;
}): Promise<{
  plan: GeneratedPlan;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}> {
  const userMsg = `Brief from the creator:

${prompt.trim()}

Design a Chatrail with ${Math.min(7, maxNodes)} nodes max. Return ONLY the JSON object — no prose, no markdown fences, no commentary.`;

  const messages: ChatMessage[] = [{ role: "user", content: userMsg }];

  // First attempt.
  let raw: string;
  let inTokens = 0;
  let outTokens = 0;
  try {
    const r = await completeChat({
      model,
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 4096,
      messages,
    });
    raw = r.text;
    inTokens += r.inputTokens;
    outTokens += r.outputTokens;
  } catch (err) {
    throw new Error(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: GeneratedPlan | null = null;
  let firstError: string | null = null;
  try {
    parsed = generatedPlanSchema.parse(extractJson(raw));
  } catch (err) {
    firstError = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String(err);
  }

  // One retry with the validation error appended so the model can self-correct.
  if (!parsed) {
    const correction: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `Your previous response failed validation:\n${firstError}\n\nReturn a corrected JSON object with the same structure. ONLY the JSON — no prose, no fences.`,
      },
    ];
    try {
      const r = await completeChat({
        model,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 4096,
        messages: correction,
      });
      inTokens += r.inputTokens;
      outTokens += r.outputTokens;
      parsed = generatedPlanSchema.parse(extractJson(r.text));
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : String(err);
      throw new Error(`Generated plan failed validation after retry: ${msg}`);
    }
  }

  // Type-level invariant: bot nodes must have systemPrompt, content nodes
  // must have bodyMarkdown. Backfill / fix here so downstream code doesn't
  // have to defensive-check.
  parsed.nodes = parsed.nodes.map((n) => {
    if (n.type === "bot" && !n.systemPrompt) {
      return {
        ...n,
        systemPrompt: `You are a tutor for "${n.title}". Stay in role. Ask one question at a time. After 6 substantive learner replies, summarize and end the conversation.`,
      };
    }
    if (n.type === "content" && !n.bodyMarkdown) {
      return { ...n, bodyMarkdown: `# ${n.title}\n\n${n.learnerInstructions}` };
    }
    return n;
  });

  return { plan: parsed, inputTokens: inTokens, outputTokens: outTokens, modelUsed: model };
}

/**
 * Pull the first complete top-level JSON object out of free-form model output.
 * Models occasionally wrap their JSON in ```json fences or prepend "Here is
 * the plan:" — this strips that and finds the first balanced { ... }.
 */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  // Strip code fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  // Find the first balanced JSON object.
  const start = candidate.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model output");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        return JSON.parse(slice);
      }
    }
  }
  throw new Error("Unterminated JSON object in model output");
}
