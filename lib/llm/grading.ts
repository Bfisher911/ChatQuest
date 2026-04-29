// AI-assisted rubric scoring suggestion. Asks the configured model to score the
// transcript against the rubric and produce a short summary.

import { completeChat, defaultModel } from "./provider";

export interface RubricCriterionForGrading {
  id: string;
  name: string;
  description: string | null;
  max_points: number;
}

export interface GradingSuggestion {
  summary: string;
  total_score: number;
  per_criterion: { criterion_id: string; score: number; rationale: string }[];
  raw: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const SYSTEM_PROMPT = `You are an academic grading assistant. You read a learner's chat transcript with a tutor and score the transcript against a rubric. You return strictly-formatted JSON, nothing else. You are honest, calibrated, and brief.`;

function buildUserPrompt(opts: {
  rubricName: string;
  criteria: RubricCriterionForGrading[];
  transcript: { role: string; content: string }[];
  learnerInstructions?: string | null;
}) {
  const transcriptText = opts.transcript
    .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join("\n\n");
  const criteriaText = opts.criteria
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id} | "${c.name}" (max ${c.max_points} pts) — ${c.description ?? ""}`,
    )
    .join("\n");

  return `RUBRIC: ${opts.rubricName}
CRITERIA:
${criteriaText}

LEARNER INSTRUCTIONS:
${opts.learnerInstructions ?? "—"}

TRANSCRIPT:
${transcriptText}

Return ONLY the JSON object, no prose around it. Schema:
{
  "summary": "≤120 word feedback summary",
  "per_criterion": [{ "criterion_id": "<uuid>", "score": <number>, "rationale": "<≤60 words>" }],
  "total_score": <sum of per_criterion scores>
}`;
}

export async function suggestRubricScore(opts: {
  rubricName: string;
  criteria: RubricCriterionForGrading[];
  transcript: { role: string; content: string }[];
  learnerInstructions?: string | null;
  model?: string;
}): Promise<GradingSuggestion> {
  const model = (opts.model as Parameters<typeof completeChat>[0]["model"]) ?? defaultModel();
  const prompt = buildUserPrompt(opts);
  const r = await completeChat({
    model,
    temperature: 0.1,
    maxTokens: 800,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const text = r.text.trim();
  // Strip code fences if the model added them.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  let parsed: { summary: string; per_criterion: { criterion_id: string; score: number; rationale: string }[]; total_score: number };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object anywhere in the response.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI grading returned non-JSON: " + cleaned.slice(0, 200));
    parsed = JSON.parse(m[0]);
  }
  return {
    summary: String(parsed.summary ?? ""),
    total_score: Number(parsed.total_score ?? 0),
    per_criterion: Array.isArray(parsed.per_criterion) ? parsed.per_criterion : [],
    raw: cleaned,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    model,
  };
}

const CONVERSATION_SUMMARY_PROMPT = `You are a study coach. Given a learner-chatbot transcript, write a 2-3 sentence summary of what the learner demonstrated. Concrete and specific. Plain text — no markdown, no preamble.`;

export async function summarizeConversation(opts: {
  transcript: { role: string; content: string }[];
  model?: string;
}): Promise<{ summary: string; inputTokens: number; outputTokens: number; model: string }> {
  const model = (opts.model as Parameters<typeof completeChat>[0]["model"]) ?? defaultModel();
  const transcriptText = opts.transcript
    .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join("\n\n");
  const r = await completeChat({
    model,
    temperature: 0.3,
    maxTokens: 240,
    systemPrompt: CONVERSATION_SUMMARY_PROMPT,
    messages: [{ role: "user", content: transcriptText }],
  });
  return { summary: r.text.trim(), inputTokens: r.inputTokens, outputTokens: r.outputTokens, model };
}
