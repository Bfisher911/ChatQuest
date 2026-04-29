import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cassette, Btn, Icon, Eyebrow, Chip } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function NodesListPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  const { data: nodes } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, display_order")
    .eq("program_id", params.id)
    .order("display_order", { ascending: true });

  return (
    <div className="cq-page">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <Eyebrow>NODES</Eyebrow>
        <Btn sm asChild>
          <Link href={`/programs/${params.id}/nodes/new`}>
            <Icon name="plus" /> ADD CHATBOT NODE
          </Link>
        </Btn>
      </div>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 20 }}>
        Phase 1 supports chatbot nodes. The drag-and-drop visual path builder, content/PDF/slides/link/milestone/cert nodes, and conditional release rules land in Phase 2.
      </p>
      <div className="cq-grid cq-grid--3">
        {(nodes ?? []).map((n, i) => (
          <Cassette
            key={n.id}
            small
            index={i + 1}
            indexWidth={4}
            title={n.title}
            meta={`${n.type.toUpperCase()} · ${n.points ?? 0} pts`}
            href={`/programs/${params.id}/nodes/${n.id}`}
          >
            <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
              <Chip>{n.type.toUpperCase()}</Chip>
            </div>
          </Cassette>
        ))}
      </div>
    </div>
  );
}
