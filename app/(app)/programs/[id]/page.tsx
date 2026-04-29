import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cassette, Eyebrow, Btn, Icon, Chip, Frame } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";

export const dynamic = "force-dynamic";

export default async function ProgramOverview({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description, status, default_model, passing_threshold")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  const { data: nodes } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, display_order, chatbot_configs(model)")
    .eq("program_id", params.id)
    .order("display_order", { ascending: true });

  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("id, status")
    .eq("program_id", params.id);

  const { data: pendingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("program_id", params.id)
    .eq("status", "submitted");

  const stats = [
    { k: "NODES", v: String(nodes?.length ?? 0) },
    { k: "LEARNERS", v: String(enrollments?.length ?? 0) },
    { k: "PENDING", v: String(pendingConv?.length ?? 0) },
    { k: "MODEL", v: (program.default_model ?? "—").toUpperCase() },
  ];

  return (
    <div className="cq-page">
      <Frame style={{ padding: 28, marginBottom: 24 }}>
        <Eyebrow>PROGRAM · {bin(1, 8)}</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
          {program.title.toUpperCase()}
        </h1>
        {program.description ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 16 }}>
            {program.description}
          </p>
        ) : null}
        <div className="cq-grid cq-grid--4" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          {stats.map((s, i) => (
            <div
              key={s.k}
              style={{ padding: 18, borderRight: i < stats.length - 1 ? "var(--hair) solid var(--ink)" : "0" }}
            >
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{s.k}</div>
              <div className="cq-title-l" style={{ fontSize: 32 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <Btn sm asChild>
            <Link href={`/programs/${program.id}/nodes/new`}>
              <Icon name="plus" /> ADD CHATBOT NODE
            </Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href={`/programs/${program.id}/kb`}>
              <Icon name="book" /> KNOWLEDGE BASE
            </Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href={`/programs/${program.id}/roster`}>
              <Icon name="user" /> ROSTER
            </Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href={`/programs/${program.id}/gradebook`}>
              <Icon name="check" /> GRADEBOOK
            </Link>
          </Btn>
        </div>
      </Frame>

      <Eyebrow>NODES</Eyebrow>
      <div className="cq-grid cq-grid--3" style={{ marginTop: 16 }}>
        {(nodes ?? []).map((n, i) => {
          const cfg = (n.chatbot_configs as { model?: string }[] | null)?.[0];
          return (
            <Cassette
              key={n.id}
              small
              index={i + 1}
              indexWidth={4}
              title={n.title}
              meta={`${n.type.toUpperCase()} · ${n.points ?? 0} pts`}
              href={`/programs/${program.id}/nodes/${n.id}`}
            >
              <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip>{n.type.toUpperCase()}</Chip>
                {cfg?.model ? <Chip ghost>{cfg.model}</Chip> : null}
              </div>
            </Cassette>
          );
        })}
        {(!nodes || nodes.length === 0) && (
          <div className="cq-frame" style={{ padding: 24, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-title-m" style={{ marginBottom: 12 }}>NO NODES YET</div>
            <Btn asChild>
              <Link href={`/programs/${program.id}/nodes/new`}>
                <Icon name="plus" /> ADD FIRST CHATBOT NODE
              </Link>
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
