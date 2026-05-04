// Streamed CSV export of the gradebook for one program.
// Available to instructors / TAs / org admins / super admins.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS gates this — non-staff readers will see no grades.
  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: nodes } = await supabase
    .from("path_nodes")
    .select("id, title, type, points, display_order")
    .eq("program_id", params.id)
    .in("type", ["bot"])
    .order("display_order", { ascending: true });
  const cols = nodes ?? [];

  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("user_id, user:users(email, full_name)")
    .eq("program_id", params.id);

  // Pull grades newest-first so the dedup-by-cell loop keeps the latest
  // attempt for multi-attempt nodes. Mirrors the gradebook page logic.
  const { data: grades } = await supabase
    .from("grades")
    .select("learner_id, node_id, percentage, score, max_score, status, graded_at, created_at")
    .eq("program_id", params.id)
    .order("created_at", { ascending: false });

  const gradeBy = new Map<string, typeof grades extends (infer T)[] | null ? T : never>();
  for (const g of grades ?? []) {
    const key = `${g.learner_id}:${g.node_id}`;
    if (gradeBy.has(key)) continue;
    gradeBy.set(key, g);
  }

  const header = [
    "name",
    "email",
    ...cols.map((c) => c.title),
    "total_score",
    "total_possible",
    "percentage",
  ];
  const lines: string[] = [header.map(csvEscape).join(",")];
  type EnrollmentRow = { user_id: string; user: { email: string; full_name: string | null } | null };
  for (const e of (enrollments ?? []) as unknown as EnrollmentRow[]) {
    let earned = 0;
    let possible = 0;
    const row = [e.user?.full_name ?? "", e.user?.email ?? ""];
    for (const c of cols) {
      const g = gradeBy.get(`${e.user_id}:${c.id}`);
      const score = g?.score == null ? null : Number(g.score);
      const max = c.points ?? Number(g?.max_score ?? 0);
      if (score != null) earned += score;
      possible += max;
      row.push(score != null ? String(score) : (g?.status ?? ""));
    }
    row.push(String(earned));
    row.push(String(possible));
    row.push(possible > 0 ? `${Math.round((earned / possible) * 100)}%` : "");
    lines.push(row.map(csvEscape).join(","));
  }
  const body = lines.join("\n");
  const filename = `${program.title.replace(/[^a-zA-Z0-9-]/g, "_")}_gradebook.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
