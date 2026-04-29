import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, Frame } from "@/components/brutalist";
import { KbUploader } from "./kb-uploader";
import { KbFileList } from "./kb-file-list";

export const dynamic = "force-dynamic";

export default async function KbPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, organization_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  // Ensure a program-level collection exists. (Created on program creation, but fall back here.)
  let { data: collection } = await supabase
    .from("knowledge_collections")
    .select("id, name")
    .eq("program_id", params.id)
    .is("node_id", null)
    .maybeSingle();
  if (!collection) {
    const { data: created } = await supabase
      .from("knowledge_collections")
      .insert({
        organization_id: program.organization_id,
        program_id: program.id,
        name: "Program Knowledge Base",
      })
      .select("id, name")
      .single();
    collection = created;
  }

  const { data: files } = await supabase
    .from("knowledge_files")
    .select("id, filename, status, status_message, pages, bytes, indexed_at, uploaded_at")
    .eq("collection_id", collection?.id)
    .order("uploaded_at", { ascending: false });

  return (
    <div className="cq-page" style={{ maxWidth: 960 }}>
      <Eyebrow>KNOWLEDGE BASE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
        PROGRAM KNOWLEDGE.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 20 }}>
        Upload PDFs, TXT, MD, or CSV. Each file is chunked and embedded into pgvector. Bots search this collection
        on every learner question and cite the file + page in their answer.
      </p>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <Chip>{collection?.name?.toUpperCase()}</Chip>
          <Chip ghost>{files?.length ?? 0} FILES</Chip>
        </div>
        {collection?.id ? (
          <KbUploader collectionId={collection.id} programId={program.id} />
        ) : null}
      </Frame>

      <KbFileList programId={program.id} files={files ?? []} />
    </div>
  );
}
