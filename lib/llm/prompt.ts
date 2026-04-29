// Builds the system prompt for a chatbot node, blending instructor config + RAG citations.

import type { SearchHit } from "@/lib/rag/search";

export interface BuildSystemPromptInput {
  basePrompt: string;
  conversationGoal?: string | null;
  completionCriteria?: string | null;
  rubricText?: string | null;
  citations?: SearchHit[];
}

export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  const parts: string[] = [];
  parts.push(input.basePrompt.trim());

  if (input.conversationGoal) {
    parts.push(`\n\n# CONVERSATION GOAL\n${input.conversationGoal.trim()}`);
  }
  if (input.completionCriteria) {
    parts.push(`\n\n# COMPLETION CRITERIA\n${input.completionCriteria.trim()}`);
  }
  if (input.rubricText) {
    parts.push(`\n\n# RUBRIC YOU'LL BE GRADED AGAINST\n${input.rubricText.trim()}`);
  }
  if (input.citations && input.citations.length > 0) {
    parts.push("\n\n# KNOWLEDGE BASE — REFERENCE THESE WHEN ANSWERING");
    for (const c of input.citations.slice(0, 8)) {
      const label = c.page_number != null ? `${c.filename} · p.${c.page_number}` : c.filename;
      parts.push(`\n[KB · ${label}]\n${truncate(c.content, 1200)}`);
    }
    parts.push(
      "\n\nWhen you draw on the knowledge base above, cite the file and page in [brackets] like [asilomar.pdf · p.4].",
    );
  }
  return parts.join("\n");
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max) + "…";
}
