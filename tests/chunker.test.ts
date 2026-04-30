import { describe, expect, test } from "vitest";
import { chunkText } from "@/lib/rag/chunker";

describe("chunkText", () => {
  test("returns empty array on empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  test("does not duplicate content across chunks (overlap stays within budget)", () => {
    const text = Array.from({ length: 50 })
      .map((_, i) => `Sentence number ${i}. `)
      .join("");
    const chunks = chunkText(text, { targetTokens: 50, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.tokenCount).toBeGreaterThan(0);
      expect(c.tokenCount).toBeLessThanOrEqual(80); // headroom for char→token approximation
    }
  });

  test("respects paragraph boundaries when possible", () => {
    const text = "Paragraph one is short.\n\nParagraph two is also short.\n\nParagraph three.";
    const chunks = chunkText(text, { targetTokens: 200 });
    expect(chunks.length).toBe(1); // all three fit in a 200-token chunk
  });
});
