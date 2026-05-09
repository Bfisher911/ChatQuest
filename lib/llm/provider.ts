// Provider-agnostic adapter for Claude (Anthropic), OpenAI-compatible, and Google Gemini models.
// Server-only — never import from a client component.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type ChatModel =
  // Claude
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "claude-3-5-sonnet-latest"
  | "claude-3-5-haiku-latest"
  // OpenAI
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4.1"
  | "gpt-4.1-mini"
  // Gemini — Google deprecated 1.x and 2.0 names in 2026; 2.5 is the
  // current generation for new accounts. Keep the legacy names typed
  // but unused-by-default so existing chatbot_configs rows don't break;
  // the runtime call will surface a friendly "model not available" if
  // a saved bot points at a retired name.
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.0-flash"           // deprecated — kept for type-compat with old DB rows
  | "gemini-2.0-flash-lite"      // deprecated — kept for type-compat
  | "gemini-1.5-pro"             // deprecated — kept for type-compat
  | "gemini-1.5-flash"           // deprecated — kept for type-compat
  // Open
  | "auto";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ChatRequest {
  model: ChatModel;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatChunk {
  delta: string;
  inputTokens?: number;
  outputTokens?: number;
  done?: boolean;
  finishReason?: string;
}

const ANTHROPIC_PREFIX = "claude-";
const OPENAI_PREFIX_RE = /^(gpt|o\d|chatgpt)/i;
const GEMINI_PREFIX = "gemini-";

function isAnthropic(model: ChatModel) {
  return model.startsWith(ANTHROPIC_PREFIX);
}

function isOpenAI(model: ChatModel) {
  return OPENAI_PREFIX_RE.test(model);
}

function isGemini(model: ChatModel) {
  return model.startsWith(GEMINI_PREFIX);
}

function pickDefault(): ChatModel {
  return (process.env.DEFAULT_CHAT_MODEL as ChatModel) || "claude-haiku-4-5";
}

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;
let _gemini: GoogleGenerativeAI | null = null;

function anthropic() {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

function openai() {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

function gemini() {
  if (_gemini) return _gemini;
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.");
  _gemini = new GoogleGenerativeAI(key);
  return _gemini;
}

/**
 * Stream chat completion as an async iterable of `ChatChunk`.
 * The final chunk has `done: true` and final token counts.
 */
export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatChunk> {
  let model = req.model;
  if (model === "auto") model = pickDefault();

  const sysMessages = req.messages.filter((m) => m.role === "system");
  const convo = req.messages.filter((m) => m.role !== "system");
  const systemPrompt = [req.systemPrompt, ...sysMessages.map((m) => m.content)]
    .filter(Boolean)
    .join("\n\n");

  if (isAnthropic(model)) {
    const stream = await anthropic().messages.stream({
      model,
      system: systemPrompt || undefined,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      messages: convo.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { delta: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    yield {
      delta: "",
      done: true,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      finishReason: final.stop_reason ?? undefined,
    };
    return;
  }

  if (isOpenAI(model)) {
    const stream = await openai().chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 1024,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...convo.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let finishReason: string | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      const fr = chunk.choices[0]?.finish_reason;
      if (delta) yield { delta };
      if (fr) finishReason = fr;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }
    yield { delta: "", done: true, inputTokens, outputTokens, finishReason };
    return;
  }

  if (isGemini(model)) {
    const m = gemini().getGenerativeModel({
      model,
      systemInstruction: systemPrompt || undefined,
      generationConfig: {
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxTokens ?? 1024,
      },
    });
    // Gemini uses { role: 'user' | 'model', parts: [{ text }] }; map "assistant" → "model".
    const history = convo.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
    const last = convo[convo.length - 1];
    const chat = m.startChat({ history });
    const stream = await chat.sendMessageStream(last?.content ?? "");

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let finishReason: string | undefined;

    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) yield { delta: text };
    }
    const final = await stream.response;
    inputTokens = final.usageMetadata?.promptTokenCount;
    outputTokens = final.usageMetadata?.candidatesTokenCount;
    finishReason = final.candidates?.[0]?.finishReason;

    yield { delta: "", done: true, inputTokens, outputTokens, finishReason };
    return;
  }

  throw new Error(`Unknown model: ${model}`);
}

/**
 * Non-streaming completion. Used for short utility calls (grading suggestions, summaries).
 */
export async function completeChat(
  req: ChatRequest,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let model = req.model;
  if (model === "auto") model = pickDefault();
  const sysMessages = req.messages.filter((m) => m.role === "system");
  const convo = req.messages.filter((m) => m.role !== "system");
  const systemPrompt = [req.systemPrompt, ...sysMessages.map((m) => m.content)]
    .filter(Boolean)
    .join("\n\n");

  if (isAnthropic(model)) {
    const r = await anthropic().messages.create({
      model,
      system: systemPrompt || undefined,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      messages: convo.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
    const text = r.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    return { text, inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens };
  }

  if (isOpenAI(model)) {
    const r = await openai().chat.completions.create({
      model,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 1024,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...convo.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });
    return {
      text: r.choices[0]?.message?.content ?? "",
      inputTokens: r.usage?.prompt_tokens ?? 0,
      outputTokens: r.usage?.completion_tokens ?? 0,
    };
  }

  if (isGemini(model)) {
    const m = gemini().getGenerativeModel({
      model,
      systemInstruction: systemPrompt || undefined,
      generationConfig: {
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxTokens ?? 1024,
      },
    });
    const history = convo.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
    const last = convo[convo.length - 1];
    const chat = m.startChat({ history });
    const r = await chat.sendMessage(last?.content ?? "");
    return {
      text: r.response.text(),
      inputTokens: r.response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: r.response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  throw new Error(`Unknown model: ${model}`);
}

/** Embed a batch of strings using the configured embedding provider. */
export async function embedBatch(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  const provider = process.env.EMBEDDING_PROVIDER ?? "openai";

  if (provider === "openai") {
    const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
    const r = await openai().embeddings.create({ model, input: texts });
    return { vectors: r.data.map((d) => d.embedding), model };
  }

  if (provider === "gemini" || provider === "google") {
    // Gemini's text-embedding-004 returns 768-dim vectors. We pad/truncate to 1536
    // to match the pgvector schema. Doubling preserves cosine similarity ordering.
    const modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-004";
    const m = gemini().getGenerativeModel({ model: modelName });
    const vectors: number[][] = [];
    for (const t of texts) {
      const r = await m.embedContent(t);
      const v = r.embedding.values;
      // Pad to 1536 dims by concatenating with itself, truncating any overflow.
      const out = v.length >= 1536 ? v.slice(0, 1536) : [...v, ...v].slice(0, 1536);
      vectors.push(out);
    }
    return { vectors, model: modelName };
  }

  throw new Error(
    `Embedding provider "${provider}" not supported. Use EMBEDDING_PROVIDER=openai (preferred) or gemini.`,
  );
}

export { pickDefault as defaultModel };
