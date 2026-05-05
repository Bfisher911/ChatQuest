import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Btn, Icon, Chip } from "@/components/brutalist";
import { BotNodeForm } from "../../bot-node-form";
import { PreviewChatPanel } from "@/components/builder/preview-chat-panel";

export const dynamic = "force-dynamic";

export default async function NodeEditorPage({
  params,
}: {
  params: { id: string; nodeId: string };
}) {
  const supabase = createClient();
  const { data: node } = await supabase
    .from("path_nodes")
    .select("id, type, title, points, program_id, chatbot_configs(system_prompt, learner_instructions, model, temperature, token_budget, max_tokens, attempts_allowed, rubric_id, use_program_kb)")
    .eq("id", params.nodeId)
    .maybeSingle();
  if (!node) notFound();
  if (node.type !== "bot") {
    return (
      <div className="cq-page">
        <Eyebrow>NODE</Eyebrow>
        <p style={{ fontFamily: "var(--font-mono)", marginTop: 12 }}>
          {node.type.toUpperCase()} nodes are configured directly in the visual builder.
        </p>
      </div>
    );
  }

  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("id, name, total_points")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 12 }}>
        <Eyebrow>EDIT BOT NODE</Eyebrow>
        <Chip>{node.type.toUpperCase()}</Chip>
      </div>
      <h1 className="cq-title-l" style={{ marginTop: 8, marginBottom: 24 }}>
        {node.title.toUpperCase()}
      </h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <Btn sm ghost asChild>
          <Link href={`/programs/${node.program_id}/builder`}>
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> BACK TO BUILDER
          </Link>
        </Btn>
      </div>
      <BotNodeForm
        programId={node.program_id}
        mode="edit"
        rubrics={rubrics ?? []}
        node={{
          id: node.id,
          title: node.title,
          points: node.points ?? 25,
          chatbot_configs: ((node.chatbot_configs as unknown) as
            | {
                system_prompt: string;
                learner_instructions: string | null;
                model: string;
                temperature: string | number;
                token_budget: number;
                max_tokens: number;
                attempts_allowed: number;
                rubric_id: string | null;
                use_program_kb: boolean | null;
              }[]
            | null)?.[0] ?? null,
        }}
      />

      {/* Inline ephemeral preview — uses the saved bot config + KB without
          creating real conversations or polluting submissions/grades. */}
      <PreviewChatPanel nodeId={node.id} />
    </div>
  );
}
