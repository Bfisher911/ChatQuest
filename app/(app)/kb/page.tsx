import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Cassette, Chip } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function KbHubPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();
  const { data: collections } = await supabase
    .from("knowledge_collections")
    .select("id, name, program_id, created_at, program:programs(title)")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page">
      <Eyebrow>KNOWLEDGE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        ALL COLLECTIONS.
      </h1>
      <div className="cq-grid cq-grid--3">
        {(collections ?? []).map((c, i) => {
          const prog = (c.program as unknown) as { title: string } | { title: string }[] | null;
          const progTitle = Array.isArray(prog) ? prog[0]?.title : prog?.title;
          return (
            <Cassette
              key={c.id}
              small
              index={i + 1}
              indexWidth={4}
              title={c.name}
              meta={progTitle ?? "—"}
              href={c.program_id ? `/programs/${c.program_id}/kb` : "/programs"}
            />
          );
        })}
        {(!collections || collections.length === 0) && (
          <div className="cq-frame" style={{ padding: 24, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ color: "var(--muted)" }}>
              No knowledge collections yet — they&apos;re created automatically when you make a program.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
