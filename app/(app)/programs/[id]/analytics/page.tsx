import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Frame, Chip } from "@/components/brutalist";
import { AnalyticsCharts } from "./analytics-charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, organization_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  // Aggregate stats
  const [{ data: enrollments }, { data: nodes }, { data: grades }, { data: usage }] = await Promise.all([
    supabase
      .from("program_enrollments")
      .select("user_id, status")
      .eq("program_id", params.id),
    supabase
      .from("path_nodes")
      .select("id, title, type, points")
      .eq("program_id", params.id)
      .order("display_order", { ascending: true }),
    supabase
      .from("grades")
      .select("learner_id, node_id, percentage, status, graded_at")
      .eq("program_id", params.id),
    supabase
      .from("usage_logs")
      .select("created_at, prompt_tokens, completion_tokens, est_cost_usd, model")
      .eq("program_id", params.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
  ]);

  const totalLearners = enrollments?.length ?? 0;
  const totalGrades = grades?.length ?? 0;
  const gradedCount = grades?.filter((g) => g.status === "graded").length ?? 0;
  const pendingCount = grades?.filter((g) => g.status === "pending_review").length ?? 0;
  const avgScore =
    grades && grades.length > 0
      ? grades.reduce((a, g) => a + Number(g.percentage ?? 0), 0) / grades.length
      : 0;

  // Per-node averages
  const byNode = new Map<string, { node_id: string; title: string; avg: number; count: number; type: string }>();
  for (const n of nodes ?? []) {
    byNode.set(n.id, { node_id: n.id, title: n.title, avg: 0, count: 0, type: n.type });
  }
  for (const g of grades ?? []) {
    const e = byNode.get(g.node_id);
    if (e && g.percentage != null) {
      e.avg = e.avg * e.count + Number(g.percentage);
      e.count += 1;
      e.avg = e.avg / e.count;
    }
  }
  const nodeStats = [...byNode.values()];

  // Token usage by day
  const tokensByDay = new Map<string, number>();
  for (const u of usage ?? []) {
    const day = u.created_at.slice(0, 10);
    tokensByDay.set(day, (tokensByDay.get(day) ?? 0) + (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0));
  }
  const tokenSeries = [...tokensByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, tokens]) => ({ day, tokens }));

  const totalTokens = tokenSeries.reduce((a, p) => a + p.tokens, 0);
  const totalCost = (usage ?? []).reduce((a, u) => a + Number(u.est_cost_usd ?? 0), 0);

  const stats = [
    { k: "LEARNERS", v: String(totalLearners) },
    { k: "GRADED", v: String(gradedCount) },
    { k: "PENDING", v: String(pendingCount) },
    { k: "AVG SCORE", v: `${Math.round(avgScore)}%` },
  ];

  return (
    <div className="cq-page">
      <Eyebrow>ANALYTICS · {program.title.toUpperCase()}</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        PROGRAM ANALYTICS.
      </h1>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <div className="cq-grid cq-grid--4" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          {stats.map((s, i) => (
            <div
              key={s.k}
              style={{ padding: 18, borderRight: i < stats.length - 1 ? "var(--hair) solid var(--ink)" : "0" }}
            >
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                {s.k}
              </div>
              <div className="cq-title-l" style={{ fontSize: 32 }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </Frame>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>AI USAGE · LAST 30 DAYS</Eyebrow>
        <div className="row" style={{ gap: 16, marginTop: 8 }}>
          <Chip>{(totalTokens / 1000).toFixed(1)}K TOKENS</Chip>
          <Chip ghost>${totalCost.toFixed(4)} EST. COST</Chip>
        </div>
        <AnalyticsCharts tokenSeries={tokenSeries} nodeStats={nodeStats} />
      </Frame>
    </div>
  );
}
