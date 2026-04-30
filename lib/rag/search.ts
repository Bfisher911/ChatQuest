// Vector search via the public.match_embeddings RPC (server-side).
// Uses the supabase service-role client because we want to honor org/collection
// scoping ourselves (the caller is always a verified server context — the chat
// stream API or the AI grading endpoint).

import { createServiceRoleClient } from "@/lib/supabase/server";
import { embedBatch } from "@/lib/llm/provider";

export interface SearchHit {
  chunk_id: string;
  file_id: string;
  filename: string;
  content: string;
  page_number: number | null;
  score: number;
}

export interface SearchOptions {
  organizationId: string;
  collectionIds: string[];
  query: string;
  limit?: number;
}

export async function searchKnowledge({
  organizationId,
  collectionIds,
  query,
  limit = 5,
}: SearchOptions): Promise<SearchHit[]> {
  if (!query.trim() || collectionIds.length === 0) return [];

  const { vectors } = await embedBatch([query]);
  const embedding = vectors[0];
  if (!embedding || embedding.length === 0) return [];

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("match_embeddings", {
    // pgvector accepts the array — Supabase JS serializes it as a numeric array
    // and the function signature converts to vector(1536).
    query_embedding: embedding as unknown as string,
    p_org: organizationId,
    p_collections: collectionIds,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error) {
    console.error("[rag/search] match_embeddings RPC failed:", error);
    return [];
  }
  type Row = {
    chunk_id: string;
    file_id: string;
    filename: string;
    content: string;
    page_number: number | null;
    score: number | string;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    chunk_id: r.chunk_id,
    file_id: r.file_id,
    filename: r.filename,
    content: r.content,
    page_number: r.page_number,
    score: Number(r.score),
  }));
}
