import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Cassette, Eyebrow, Btn, Icon, Chip, Frame } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function RubricsPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("id, name, description, total_points, is_visible_to_learners, created_at")
    .order("created_at", { ascending: false });

  // Counts of attached chatbot nodes per rubric (read-only nice-to-know).
  const ids = (rubrics ?? []).map((r) => r.id);
  const { data: attached } = await supabase
    .from("chatbot_configs")
    .select("rubric_id")
    .in("rubric_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const counts = new Map<string, number>();
  for (const a of attached ?? []) {
    if (a.rubric_id) counts.set(a.rubric_id, (counts.get(a.rubric_id) ?? 0) + 1);
  }

  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <Eyebrow>RUBRICS</Eyebrow>
        <Btn sm asChild>
          <Link href="/rubrics/new">
            <Icon name="plus" /> NEW RUBRIC
          </Link>
        </Btn>
      </div>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        Rubrics turn vibes into scorecards. Attach one to a chatbot node so the AI can
        suggest scores against named, weighted criteria — instructor still has the
        final say on every cell.
      </p>

      {(!rubrics || rubrics.length === 0) ? (
        <Frame style={{ padding: 32, textAlign: "center" }}>
          <Eyebrow>NO RUBRICS YET</Eyebrow>
          <div className="cq-title-m" style={{ marginTop: 12, marginBottom: 24 }}>
            BUILD YOUR FIRST RUBRIC.
          </div>
          <Btn asChild>
            <Link href="/rubrics/new">
              <Icon name="plus" /> NEW RUBRIC
            </Link>
          </Btn>
        </Frame>
      ) : (
        <div className="cq-grid cq-grid--3">
          {rubrics.map((r, i) => {
            const attachedTo = counts.get(r.id) ?? 0;
            return (
              <Cassette
                key={r.id}
                small
                index={i + 1}
                indexWidth={4}
                title={r.name}
                meta={`${r.total_points ?? 0} pts`}
                href={`/rubrics/${r.id}`}
              >
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                  {r.description?.slice(0, 80) ?? "—"}
                </p>
                <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip ghost>{r.total_points ?? 0} PTS</Chip>
                  {attachedTo > 0 ? <Chip>ATTACHED · {attachedTo}</Chip> : null}
                  {r.is_visible_to_learners ? <Chip ghost>SHOWN TO LEARNERS</Chip> : null}
                </div>
              </Cassette>
            );
          })}
        </div>
      )}
    </div>
  );
}
