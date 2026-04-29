import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/brutalist";
import { ProgramSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ProgramSettings({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description, status, default_model, passing_threshold, monthly_token_budget, share_conversations_with_org_admin")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  return (
    <div className="cq-page" style={{ maxWidth: 720 }}>
      <Eyebrow>SETTINGS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        PROGRAM SETTINGS.
      </h1>
      <ProgramSettingsForm program={program} />
    </div>
  );
}
