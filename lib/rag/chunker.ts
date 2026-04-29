// Simple, dependency-light text chunker.
// Splits on paragraph + sentence boundaries with a target token budget per chunk.
// "Tokens" here are a 4-chars-per-token heuristic — accurate enough for budgeting.

const APPROX_CHARS_PER_TOKEN = 4;

export interface ChunkOptions {
  /** Target token count per chunk. */
  targetTokens?: number;
  /** Max overlap (in tokens) between consecutive chunks. */
  overlapTokens?: number;
}

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
}

export function chunkText(text: string, opts: ChunkOptions = {}): Chunk[] {
  const targetTokens = opts.targetTokens ?? 400;
  const overlapTokens = Math.min(opts.overlapTokens ?? 50, Math.floor(targetTokens / 2));
  const targetChars = targetTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * APPROX_CHARS_PER_TOKEN;

  const cleaned = text.replace(/\r\n/g, "\n").replace(/ /g, " ").trim();
  if (!cleaned) return [];

  // Split into rough paragraphs first.
  const paragraphs = cleaned.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = "";

  for (const para of paragraphs) {
    if ((buffer.length + para.length + 2) <= targetChars) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
      continue;
    }
    if (buffer) {
      chunks.push(makeChunk(chunks.length, buffer));
      // start next buffer with overlap from previous
      buffer = tail(buffer, overlapChars);
    }
    if (para.length <= targetChars) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      // Big paragraph: hard-split on sentences.
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if ((buffer.length + s.length + 1) <= targetChars) {
          buffer = buffer ? `${buffer} ${s}` : s;
        } else {
          if (buffer) {
            chunks.push(makeChunk(chunks.length, buffer));
            buffer = tail(buffer, overlapChars);
          }
          if (s.length > targetChars) {
            // Truly big sentence — chunk on character window.
            for (let i = 0; i < s.length; i += targetChars - overlapChars) {
              const slice = s.slice(i, i + targetChars);
              chunks.push(makeChunk(chunks.length, slice));
            }
            buffer = "";
          } else {
            buffer = s;
          }
        }
      }
    }
  }
  if (buffer.trim()) chunks.push(makeChunk(chunks.length, buffer));
  return chunks;
}

function makeChunk(index: number, content: string): Chunk {
  const trimmed = content.trim();
  return {
    index,
    content: trimmed,
    tokenCount: Math.ceil(trimmed.length / APPROX_CHARS_PER_TOKEN),
  };
}

function tail(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}
