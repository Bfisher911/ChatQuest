// Stream a chatbot conversation as a Markdown transcript.
// Authorization: the learner who owns the conversation, any instructor / TA /
// org admin in the program's org (RLS-checked via the user-scoped client),
// or super admin.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull conversation via the RLS-aware client first so non-owners get blocked.
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, learner_id, attempt_number, started_at, submitted_at, status, ai_summary, total_prompt_tokens, total_completion_tokens, program:programs(title, organization_id), node:path_nodes(title, type)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  // Pull messages via service role so we get full content even if a learner
  // policy quirk hides them (they own the conversation, but defensively).
  const admin = createServiceRoleClient();
  const { data: messages } = await admin
    .from("conversation_messages")
    .select("role, content, citations, model, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;
  const program = pickOne(conv.program as unknown) as { title: string; organization_id: string } | null;
  const node = pickOne(conv.node as unknown) as { title: string; type: string } | null;

  // Fetch learner display name for the header.
  const { data: learner } = await admin
    .from("users")
    .select("full_name, display_name, email")
    .eq("id", conv.learner_id)
    .maybeSingle();

  const md = renderMarkdown({
    program: program?.title ?? "Chatrail",
    node: node?.title ?? "Chatbot",
    learner: learner?.full_name ?? learner?.display_name ?? learner?.email ?? "Learner",
    attempt: conv.attempt_number,
    status: conv.status,
    startedAt: conv.started_at,
    submittedAt: conv.submitted_at,
    aiSummary: conv.ai_summary,
    totalPromptTokens: conv.total_prompt_tokens,
    totalCompletionTokens: conv.total_completion_tokens,
    messages: (messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      citations: (m.citations as { filename?: string; page?: number; score?: number }[] | null) ?? [],
      model: m.model,
      createdAt: m.created_at,
    })),
  });

  const filename = `${(node?.title ?? "transcript").replace(/[^a-zA-Z0-9-]/g, "_")}_attempt-${conv.attempt_number}.md`;

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

interface RenderInput {
  program: string;
  node: string;
  learner: string;
  attempt: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  aiSummary: string | null;
  totalPromptTokens: number | null;
  totalCompletionTokens: number | null;
  messages: {
    role: string;
    content: string;
    citations: { filename?: string; page?: number; score?: number }[];
    model: string | null;
    createdAt: string;
  }[];
}

function renderMarkdown(d: RenderInput): string {
  const lines: string[] = [];
  lines.push(`# ${d.node}`);
  lines.push("");
  lines.push(`**Chatrail:** ${d.program}`);
  lines.push(`**Learner:** ${d.learner}`);
  lines.push(`**Attempt:** ${d.attempt}`);
  lines.push(`**Status:** ${d.status}`);
  lines.push(`**Started:** ${d.startedAt}`);
  if (d.submittedAt) lines.push(`**Submitted:** ${d.submittedAt}`);
  const totalTokens = (d.totalPromptTokens ?? 0) + (d.totalCompletionTokens ?? 0);
  if (totalTokens > 0) lines.push(`**Tokens used:** ${totalTokens.toLocaleString()}`);
  lines.push("");
  if (d.aiSummary) {
    lines.push(`> **AI summary:** ${d.aiSummary.replace(/\n/g, " ")}`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  for (const m of d.messages) {
    const who = m.role === "user" ? d.learner : m.role === "assistant" ? "Bot" : "System";
    lines.push(`### ${who} · ${m.createdAt}`);
    if (m.role === "assistant" && m.model) lines.push(`*Model: \`${m.model}\`*`);
    lines.push("");
    lines.push(m.content);
    if (m.citations.length > 0) {
      lines.push("");
      lines.push("**Citations:**");
      for (const c of m.citations) {
        const label = c.filename
          ? c.page != null
            ? `${c.filename} · p.${c.page}`
            : c.filename
          : "Unknown source";
        const score = c.score != null ? ` (score ${c.score.toFixed(2)})` : "";
        lines.push(`- ${label}${score}`);
      }
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(`*Exported from Chatrail.*`);
  return lines.join("\n");
}
