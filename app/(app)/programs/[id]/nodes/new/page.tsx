import * as React from "react";
import { Eyebrow } from "@/components/brutalist";
import { BotNodeForm } from "../../bot-node-form";

export default function NewNodePage({ params }: { params: { id: string } }) {
  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <Eyebrow>NEW CHATBOT NODE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        CONFIGURE THE BOT.
      </h1>
      <BotNodeForm programId={params.id} mode="create" />
    </div>
  );
}
