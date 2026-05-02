import * as React from "react";
import { Eyebrow } from "@/components/brutalist";
import { createClient } from "@/lib/supabase/server";
import { BotNodeForm } from "../../bot-node-form";

export const dynamic = "force-dynamic";

export default async function NewNodePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("id, name, total_points")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <Eyebrow>NEW CHATBOT NODE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        CONFIGURE THE BOT.
      </h1>
      <BotNodeForm programId={params.id} mode="create" rubrics={rubrics ?? []} />
    </div>
  );
}
