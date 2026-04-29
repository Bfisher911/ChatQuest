// Vector search across knowledge collections. Service-role client because we
// need to apply our own org/program scoping after the SQL.

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
  const v = vectors[0];

  const admin = createServiceRoleClient();
  // Use a raw SQL query against the underlying postgres connection via Supabase
  // PostgREST RPC pattern won't work for vectors directly without an SQL fn,
  // so we use the rest "match" via a stored function.
  // For Phase 1, fall back to using rpc on a function we define here.
  // Since we don't have that fn yet, use postgrest with a `<=>` distance through filter.
  // Easier: use the underlying Drizzle/postgres client instead.

  const { db } = await import("@/lib/db/client");
  const conn = db();
  // Cosine distance: smaller is closer. Score = 1 - distance.
  const literal = `[${v.join(",")}]`;
  const collectionFilter = collectionIds.map((id) => `'${id}'`).join(",");

  const rows = (await conn.execute(
    `select
       e.chunk_id,
       c.file_id,
       f.filename,
       c.content,
       c.page_number,
       1 - (e.embedding <=> '${literal}'::vector) as score
     from public.embeddings e
     join public.document_chunks c on c.id = e.chunk_id
     join public.knowledge_files f on f.id = c.file_id
     where e.organization_id = '${organizationId}'
       and e.collection_id in (${collectionFilter || "''"})
     order by e.embedding <=> '${literal}'::vector
     limit ${Math.min(Math.max(limit, 1), 20)}`,
  )) as unknown as Array<{
    chunk_id: string;
    file_id: string;
    filename: string;
    content: string;
    page_number: number | null;
    score: number;
  }>;

  return rows.map((r) => ({
    chunk_id: r.chunk_id,
    file_id: r.file_id,
    filename: r.filename,
    content: r.content,
    page_number: r.page_number,
    score: Number(r.score),
  }));
}
