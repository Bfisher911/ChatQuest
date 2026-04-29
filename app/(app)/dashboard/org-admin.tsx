import * as React from "react";
import Link from "next/link";
import { Cassette, CassetteStats, Chip, Eyebrow, Icon, Btn, Frame } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";

type Supabase = ReturnType<typeof import("@/lib/supabase/server").createClient>;

export async function OrgAdminDashboard({
  supabase,
  userName,
  organizationId,
}: {
  supabase: Supabase;
  userName: string;
  organizationId: string;
}) {
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, plan_code, is_active")
    .eq("id", organizationId)
    .single();

  const { data: members } = await supabase
    .from("organization_members")
    .select("role, user_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const { data: programs } = await supabase
    .from("programs")
    .select("id, title, status")
    .eq("organization_id", organizationId);

  const { data: plans } = await supabase
    .from("plans")
    .select("code, instructor_seats, learner_seats, monthly_token_budget, name")
    .eq("code", org?.plan_code ?? "free")
    .maybeSingle();

  const instructorCount = members?.filter((m) => m.role === "instructor").length ?? 0;
  const learnerCount = members?.filter((m) => m.role === "learner").length ?? 0;
  const taCount = members?.filter((m) => m.role === "ta").length ?? 0;

  const instrSeats = plans?.instructor_seats ?? 0;
  const lrnSeats = plans?.learner_seats ?? 0;

  const stats = [
    { k: "PLAN", v: (org?.plan_code ?? "FREE").toUpperCase() },
    { k: "INSTR SEATS", v: `${instructorCount}/${instrSeats}` },
    { k: "LEARNER SEATS", v: `${learnerCount}/${lrnSeats}` },
    { k: "PROGRAMS", v: String(programs?.length ?? 0) },
  ];

  return (
    <div className="cq-page">
      <Frame style={{ padding: 28, marginBottom: 24, position: "relative" }}>
        <div className="cq-cassette__corner">
          <Icon name="lock" size={10} /> ORG ADMIN
        </div>
        <div className="cq-mono" style={{ fontSize: 18, marginBottom: 12 }}>{bin(2, 8)}</div>
        <h1 className="cq-title-l" style={{ marginBottom: 8 }}>
          {(org?.name ?? "ORGANIZATION").toUpperCase()}
        </h1>
        <div className="cq-mono" style={{ fontSize: 14, marginBottom: 20, color: "var(--muted)" }}>
          ADMIN: {userName.toUpperCase()}
        </div>
        <div className="cq-grid cq-grid--4" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          {stats.map((s, i) => (
            <div
              key={s.k}
              style={{
                padding: 18,
                borderRight: i < stats.length - 1 ? "var(--hair) solid var(--ink)" : "0",
              }}
            >
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                {s.k}
              </div>
              <div className="cq-title-l" style={{ fontSize: 36 }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 20, gap: 8 }}>
          <Btn sm asChild>
            <Link href="/org/members"><Icon name="user" /> MANAGE MEMBERS</Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href="/org/billing"><Icon name="settings" /> BILLING</Link>
          </Btn>
        </div>
      </Frame>

      <Eyebrow>PROGRAMS</Eyebrow>
      <div className="cq-grid cq-grid--3" style={{ marginTop: 16, paddingBottom: 28 }}>
        {(programs ?? []).map((p, i) => (
          <Cassette
            key={p.id}
            index={i + 1}
            title={p.title}
            meta={(p.status ?? "").toUpperCase()}
            href={`/programs/${p.id}`}
          >
            <Chip ghost>{p.status?.toUpperCase()}</Chip>
          </Cassette>
        ))}
      </div>
    </div>
  );
}
