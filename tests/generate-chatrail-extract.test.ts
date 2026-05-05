import { describe, expect, test } from "vitest";
import { generatedPlanSchema } from "@/lib/llm/generate-chatrail";

// We don't export extractJson from the module, so test the schema validation
// directly — that's the load-bearing piece. extractJson is straightforward.

const VALID_PLAN = {
  title: "Stoic Foundations",
  description: "A short intro to Stoic philosophy with active practice.",
  defaultModel: "claude-haiku-4-5",
  nodes: [
    {
      title: "Welcome to Stoicism",
      type: "bot",
      learnerInstructions: "Discuss what you already know about Stoic ideas.",
      systemPrompt:
        "You are a friendly philosophy tutor. Stay in role. Ask one question at a time. After 5 substantive learner responses, summarize and end.",
      points: 25,
      tokenBudget: 6000,
      maxTokens: 800,
      attemptsAllowed: 2,
      temperature: 0.4,
    },
  ],
};

describe("generatedPlanSchema", () => {
  test("accepts a minimal valid plan", () => {
    const r = generatedPlanSchema.safeParse(VALID_PLAN);
    expect(r.success).toBe(true);
  });

  test("rejects empty node list", () => {
    const r = generatedPlanSchema.safeParse({ ...VALID_PLAN, nodes: [] });
    expect(r.success).toBe(false);
  });

  test("rejects more than 12 nodes", () => {
    const r = generatedPlanSchema.safeParse({
      ...VALID_PLAN,
      nodes: Array(13).fill(VALID_PLAN.nodes[0]),
    });
    expect(r.success).toBe(false);
  });

  test("rejects unknown node type", () => {
    const r = generatedPlanSchema.safeParse({
      ...VALID_PLAN,
      nodes: [{ ...VALID_PLAN.nodes[0], type: "video" }],
    });
    expect(r.success).toBe(false);
  });

  test("rejects unknown defaultModel", () => {
    const r = generatedPlanSchema.safeParse({
      ...VALID_PLAN,
      defaultModel: "gpt-99",
    });
    expect(r.success).toBe(false);
  });

  test("clamps numeric defaults to schema range", () => {
    const r = generatedPlanSchema.safeParse({
      ...VALID_PLAN,
      nodes: [
        {
          ...VALID_PLAN.nodes[0],
          tokenBudget: 100, // below min 1000
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  test("accepts content-type node with bodyMarkdown instead of systemPrompt", () => {
    const r = generatedPlanSchema.safeParse({
      ...VALID_PLAN,
      nodes: [
        {
          title: "Reading: Marcus on Discipline",
          type: "content",
          learnerInstructions: "Read carefully and acknowledge.",
          bodyMarkdown: "# The discipline of action\n\nMarcus writes that...",
          points: 10,
          tokenBudget: 6000,
          maxTokens: 1024,
          attemptsAllowed: 1,
          temperature: 0.4,
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});
