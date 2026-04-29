import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Cassette } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";

export const dynamic = "force-dynamic";

export default async function RubricsPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("id, name, total_points, description")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page">
      <Eyebrow>RUBRICS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        REUSABLE RUBRICS.
      </h1>
      <div className="cq-grid cq-grid--3">
        {(rubrics ?? []).map((r, i) => (
          <Cassette
            key={r.id}
            small
            index={i + 1}
            indexWidth={4}
            title={r.name}
            meta={`${r.total_points ?? 0} pts`}
            staticCard
          >
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
              {r.description?.slice(0, 80) ?? "—"}
            </p>
          </Cassette>
        ))}
        {(!rubrics || rubrics.length === 0) && (
          <div className="cq-frame" style={{ padding: 24, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ color: "var(--muted)" }}>
              Phase 1 ships seeded rubrics. The rubric builder UI lands in Phase 2.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
