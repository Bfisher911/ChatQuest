import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/brutalist";
import { ProgramSubnav } from "./subnav";

export default async function ProgramLayout({
  params,
  children,
}: {
  params: { id: string };
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "20px 28px", borderBottom: "var(--hair) solid var(--ink)" }}>
        <div className="cq-pb__crumbs">
          <Link href="/programs" style={{ color: "var(--muted)" }}>CHATRAILS</Link>
          <span className="sep">/</span>
          <span>{program.title.toUpperCase()}</span>
        </div>
        <ProgramSubnav programId={params.id} status={program.status as string} />
      </div>
      {children}
    </div>
  );
}
