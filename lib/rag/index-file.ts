// Indexing pipeline: storage → extract → chunk → embed → write rows.
// Called from app/api/kb/index/route.ts after upload, and idempotently re-callable.

import { createServiceRoleClient } from "@/lib/supabase/server";
import { embedBatch } from "@/lib/llm/provider";
import { logUsage } from "@/lib/llm/usage";
import { extractDocument } from "./extract";
import { chunkText } from "./chunker";

const KB_BUCKET = "kb-files";
const EMBED_BATCH_SIZE = 16;

export interface IndexResult {
  chunks: number;
  pages?: number;
  status: "indexed" | "failed";
  error?: string;
}

export async function indexKnowledgeFile(
  fileId: string,
  organizationId: string | null,
  userId: string | null,
): Promise<IndexResult> {
  const admin = createServiceRoleClient();
  const { data: file, error: fileErr } = await admin
    .from("knowledge_files")
    .select("id, collection_id, organization_id, filename, storage_path, mime_type")
    .eq("id", fileId)
    .single();
  if (fileErr || !file) {
    return { chunks: 0, status: "failed", error: fileErr?.message ?? "File not found" };
  }

  await admin.from("knowledge_files").update({ status: "processing", status_message: null }).eq("id", fileId);

  try {
    const { data: download, error: dlErr } = await admin.storage
      .from(KB_BUCKET)
      .download(file.storage_path);
    if (dlErr || !download) throw new Error(dlErr?.message ?? "Download failed");
    const arrayBuf = await download.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const extracted = await extractDocument(file.filename, file.mime_type ?? undefined, buffer);
    if (!extracted.text.trim()) {
      throw new Error("Document contained no extractable text.");
    }

    const chunks = chunkText(extracted.text, { targetTokens: 400, overlapTokens: 50 });

    // Reset existing chunks/embeddings (re-index).
    await admin.from("document_chunks").delete().eq("file_id", fileId);

    if (chunks.length === 0) {
      await admin
        .from("knowledge_files")
        .update({ status: "indexed", indexed_at: new Date().toISOString(), pages: extracted.pageCount ?? null })
        .eq("id", fileId);
      return { chunks: 0, pages: extracted.pageCount, status: "indexed" };
    }

    // Insert chunks first to get their ids.
    const chunkRows = chunks.map((c) => ({
      file_id: fileId,
      collection_id: file.collection_id,
      organization_id: file.organization_id,
      chunk_index: c.index,
      content: c.content,
      token_count: c.tokenCount,
    }));
    const { data: insertedChunks, error: chunkInsertErr } = await admin
      .from("document_chunks")
      .insert(chunkRows)
      .select("id, chunk_index, content");
    if (chunkInsertErr || !insertedChunks) throw new Error(chunkInsertErr?.message ?? "Chunk insert failed");

    // Sort by chunk_index to align with embed order.
    insertedChunks.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));

    // Batch embed.
    let totalEmbeddingTokens = 0;
    let embeddingModel = "";
    for (let i = 0; i < insertedChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = insertedChunks.slice(i, i + EMBED_BATCH_SIZE);
      const { vectors, model } = await embedBatch(batch.map((c) => c.content));
      embeddingModel = model;
      const rows = batch.map((c, idx) => ({
        chunk_id: c.id,
        collection_id: file.collection_id,
        organization_id: file.organization_id,
        model,
        embedding: pgvectorLiteral(vectors[idx]),
      }));
      const { error: embErr } = await admin.from("embeddings").insert(rows);
      if (embErr) throw new Error(embErr.message);
      // Estimated tokens for the batch (heuristic).
      totalEmbeddingTokens += batch.reduce((a, c) => a + (c.content.length / 4), 0);
    }

    await admin
      .from("knowledge_files")
      .update({
        status: "indexed",
        indexed_at: new Date().toISOString(),
        pages: extracted.pageCount ?? null,
      })
      .eq("id", fileId);

    await logUsage({
      organizationId,
      userId,
      kind: "embedding",
      model: embeddingModel,
      promptTokens: Math.ceil(totalEmbeddingTokens),
      completionTokens: 0,
    });

    return { chunks: chunks.length, pages: extracted.pageCount, status: "indexed" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await admin
      .from("knowledge_files")
      .update({ status: "failed", status_message: message })
      .eq("id", fileId);
    return { chunks: 0, status: "failed", error: message };
  }
}

/** pgvector literal for INSERT — '[0.1,0.2,...]'. */
function pgvectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
