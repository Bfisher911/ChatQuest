import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Btn, Icon, Frame, Chip } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";
import { KbHubFilters } from "./hub-filters";
import { KbFileRow } from "./file-row";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  collection?: string;
}

const STATUSES = ["pending", "processing", "indexed", "failed"] as const;

function fmtBytes(b: number | null) {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default async function KbHubPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  const supabase = createClient();
  const orgId = session.activeOrganizationId;

  // Pull every collection in the org with its parent program.
  const { data: collectionsRaw } = await supabase
    .from("knowledge_collections")
    .select("id, name, program_id, program:programs(title)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  type CollectionRow = { id: string; name: string; program_id: string | null; program: { title: string }[] | { title: string } | null };
  const collections = (collectionsRaw ?? []) as unknown as CollectionRow[];
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;
  const collectionMap = new Map<string, { id: string; name: string; programId: string | null; programTitle: string | null }>();
  for (const c of collections) {
    collectionMap.set(c.id, {
      id: c.id,
      name: c.name,
      programId: c.program_id,
      programTitle: pickOne(c.program)?.title ?? null,
    });
  }

  // Pull every file in the org. We post-filter client-side-style here because
  // there's no full-text index on filename yet; ILIKE is fine for low volume.
  let filesQuery = supabase
    .from("knowledge_files")
    .select("id, filename, status, status_message, pages, bytes, indexed_at, uploaded_at, collection_id, mime_type")
    .eq("organization_id", orgId)
    .order("uploaded_at", { ascending: false });
  if (searchParams.q) filesQuery = filesQuery.ilike("filename", `%${searchParams.q}%`);
  if (searchParams.status && (STATUSES as readonly string[]).includes(searchParams.status)) {
    filesQuery = filesQuery.eq("status", searchParams.status);
  }
  if (searchParams.collection) filesQuery = filesQuery.eq("collection_id", searchParams.collection);
  const { data: files } = await filesQuery;
  const fileRows = files ?? [];

  // Stats over the *unfiltered* org-wide file set so the band is consistent
  // regardless of search input.
  const { data: allFiles } = await supabase
    .from("knowledge_files")
    .select("id, status, bytes, pages")
    .eq("organization_id", orgId);
  const total = allFiles?.length ?? 0;
  const indexed = allFiles?.filter((f) => f.status === "indexed").length ?? 0;
  const failed = allFiles?.filter((f) => f.status === "failed").length ?? 0;
  const totalBytes = (allFiles ?? []).reduce((a, f) => a + (f.bytes ?? 0), 0);
  const totalPages = (allFiles ?? []).reduce((a, f) => a + (f.pages ?? 0), 0);
  const indexedPct = total === 0 ? 0 : Math.round((indexed / total) * 100);

  return (
    <div className="cq-page" style={{ maxWidth: 1200 }}>
      <Eyebrow>KNOWLEDGE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        ALL KNOWLEDGE.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        Every PDF, TXT, MD, CSV, and DOCX uploaded across all your Chatrails.
        Search by filename, filter by indexing status, re-index or delete from
        one place.
      </p>

      <Frame style={{ padding: 20, marginBottom: 24 }}>
        <div className="cq-grid cq-grid--4" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          <Stat label="FILES" value={String(total)} />
          <Stat label="INDEXED" value={`${indexed} / ${total}`} sub={`${indexedPct}%`} />
          <Stat label="PAGES" value={String(totalPages)} />
          <Stat label="STORAGE" value={fmtBytes(totalBytes)} last />
        </div>
        {failed > 0 ? (
          <div className="cq-mono" style={{ fontSize: 12, marginTop: 12, color: "var(--ink)" }}>
            ■ {failed} FILE{failed === 1 ? "" : "S"} FAILED INDEXING — RE-INDEX BELOW.
          </div>
        ) : null}
      </Frame>

      <KbHubFilters
        initialQuery={searchParams.q ?? ""}
        initialStatus={searchParams.status ?? ""}
        initialCollection={searchParams.collection ?? ""}
        collections={[...collectionMap.values()]
          .map((c) => ({ id: c.id, label: c.programTitle ? `${c.programTitle} · ${c.name}` : c.name }))
          .sort((a, b) => a.label.localeCompare(b.label))}
      />

      {fileRows.length === 0 ? (
        <Frame style={{ padding: 32, textAlign: "center", marginTop: 24 }}>
          <Eyebrow>NO FILES MATCH</Eyebrow>
          <div className="cq-title-m" style={{ marginTop: 12, marginBottom: 16 }}>
            {total === 0 ? "NOTHING UPLOADED YET." : "NO MATCHES FOR YOUR FILTERS."}
          </div>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 20 }}>
            Upload KB files inside any Chatrail&apos;s Knowledge tab; they&apos;ll show up here.
          </p>
          <Btn asChild>
            <Link href="/programs">
              <Icon name="arrow" /> CHATRAILS
            </Link>
          </Btn>
        </Frame>
      ) : (
        <Frame style={{ padding: 0, marginTop: 24, overflow: "auto" }}>
          <table className="cq-table">
            <thead>
              <tr>
                <th>FILE</th>
                <th>CHATRAIL</th>
                <th className="num">STATUS</th>
                <th className="num">PAGES</th>
                <th className="num">SIZE</th>
                <th className="num">UPLOADED</th>
                <th className="num">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {fileRows.map((f) => {
                const c = collectionMap.get(f.collection_id);
                return (
                  <KbFileRow
                    key={f.id}
                    file={{
                      id: f.id,
                      filename: f.filename,
                      status: f.status,
                      statusMessage: f.status_message,
                      pages: f.pages,
                      bytes: f.bytes,
                      uploadedAt: f.uploaded_at,
                      indexedAt: f.indexed_at,
                      collectionName: c?.name ?? "—",
                      programId: c?.programId ?? null,
                      programTitle: c?.programTitle ?? "—",
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </Frame>
      )}

      <div style={{ marginTop: 24 }}>
        <Eyebrow>COLLECTIONS · {collections.length}</Eyebrow>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {collections.map((c) => (
            <Chip key={c.id} ghost>
              <Link
                href={c.program_id ? `/programs/${c.program_id}/kb` : "#"}
                style={{ textDecoration: "none" }}
              >
                {pickOne(c.program)?.title ?? c.name}
              </Link>
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  last,
}: {
  label: string;
  value: string;
  sub?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRight: last ? "0" : "var(--hair) solid var(--ink)",
      }}
    >
      <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="cq-title-m" style={{ fontSize: 22 }}>
        {value}
      </div>
      {sub ? (
        <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
