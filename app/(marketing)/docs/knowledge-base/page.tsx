import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn } from "@/components/brutalist";

export const metadata = {
  title: "Knowledge base + RAG — Chatrail docs",
  description: "How uploads become embeddings the chatbot can cite.",
};
export const revalidate = 3600;

export default function KbDocs() {
  return (
    <article className="cq-page" style={{ maxWidth: 760, fontFamily: "var(--font-sans)" }}>
      <Eyebrow>DOCS · KNOWLEDGE BASE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        UPLOAD, INDEX, CITE.
      </h1>

      <p style={{ fontSize: 16, lineHeight: 1.55, marginBottom: 16 }}>
        Every program has a knowledge base — a set of files the chatbot can
        reference inline when answering. Uploads happen on the program&apos;s{" "}
        <strong>KNOWLEDGE</strong> tab; indexing is automatic and synchronous
        (you&apos;ll see <code>INDEXED</code> as soon as it&apos;s ready).
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>SUPPORTED FORMATS</h2>
      <p>PDF · TXT · Markdown · CSV · DOCX. 20 MiB per file. Magic bytes
      verified — extension spoofing is rejected.</p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>PIPELINE</h2>
      <ol style={{ fontSize: 16, lineHeight: 1.7, paddingLeft: 24 }}>
        <li><strong>Upload</strong> → file lands in Supabase Storage (private bucket).</li>
        <li><strong>Extract</strong> → plain text via pdf-parse or mammoth.</li>
        <li><strong>Chunk</strong> → ~400-token windows with 50-token overlap.</li>
        <li><strong>Embed</strong> → OpenAI <code>text-embedding-3-small</code> or Gemini <code>text-embedding-004</code>.</li>
        <li><strong>Store</strong> → pgvector cosine index in <code>extensions.vector</code>.</li>
      </ol>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>RETRIEVAL</h2>
      <p>
        On every learner message, the bot embeds the message, calls the
        <code> match_embeddings </code> Postgres RPC, and gets the top-5 chunks
        scoped to the program&apos;s collection. Those chunks are appended to the
        system prompt with a citation hint:{" "}
        <em>&quot;cite the file and page in [brackets] like [asilomar.pdf · p.4]&quot;</em>.
        The bot generally complies; if it doesn&apos;t, sharpen the system prompt.
      </p>

      <h2 className="cq-title-m" style={{ marginTop: 24, marginBottom: 8 }}>TENANT ISOLATION</h2>
      <p>
        Embeddings, chunks, and files are scoped to the owning organization
        via RLS. An instructor in org A cannot read org B&apos;s knowledge base
        even with the same anon key. The vector RPC enforces the org filter
        server-side.
      </p>

      <div style={{ marginTop: 32 }}>
        <Btn ghost asChild>
          <Link href="/docs">BACK TO DOCS</Link>
        </Btn>
      </div>
    </article>
  );
}
