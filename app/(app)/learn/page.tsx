import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Cassette, Eyebrow, Chip } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function LearnHub() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("program:programs(id, title, description, status)")
    .eq("user_id", session.user.id);

  type EnrollRow = { program: { id: string; title: string; description: string | null; status: string | null } | null };
  const programs = ((enrollments ?? []) as unknown as EnrollRow[])
    .map((e) => e.program)
    .filter((p): p is NonNullable<EnrollRow["program"]> => Boolean(p));

  return (
    <div className="cq-page">
      <Eyebrow>MY CHATRAILS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        LEARN.
      </h1>
      <div className="cq-grid cq-grid--3">
        {programs.map((p, i) => (
          <Cassette key={p.id} index={i + 1} title={p.title} meta={p.description?.slice(0, 80) ?? "—"} href={`/learn/${p.id}`}>
            <Chip ghost>{p.status?.toUpperCase()}</Chip>
          </Cassette>
        ))}
        {programs.length === 0 && (
          <div className="cq-frame" style={{ padding: 28, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
              You haven&apos;t been enrolled in any programs yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
