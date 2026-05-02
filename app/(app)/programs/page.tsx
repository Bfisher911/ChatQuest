import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Cassette, Eyebrow, Btn, Icon, Chip } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function ProgramsListPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();
  const { data: programs } = await supabase
    .from("programs")
    .select("id, title, description, status, default_model, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <Eyebrow>CHATRAILS</Eyebrow>
        <Btn sm asChild>
          <Link href="/programs/new">
            <Icon name="plus" /> NEW CHATRAIL
          </Link>
        </Btn>
      </div>
      <div className="cq-grid cq-grid--3">
        {(programs ?? []).map((p, i) => (
          <Cassette
            key={p.id}
            index={i + 1}
            title={p.title}
            meta={p.description?.slice(0, 80) ?? "—"}
            href={`/programs/${p.id}`}
            corner={<>{p.status?.toUpperCase()}</>}
          >
            <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip ghost>{p.default_model?.toUpperCase()}</Chip>
            </div>
          </Cassette>
        ))}
        {(!programs || programs.length === 0) && (
          <div className="cq-frame" style={{ padding: 32, gridColumn: "1 / -1", textAlign: "center" }}>
            <div className="cq-title-m">NO CHATRAILS YET</div>
            <p style={{ fontFamily: "var(--font-mono)", margin: "12px 0 20px" }}>
              Create one to start building chatbot-native curricula.
            </p>
            <Btn asChild>
              <Link href="/programs/new">
                <Icon name="plus" /> CREATE CHATRAIL
              </Link>
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
