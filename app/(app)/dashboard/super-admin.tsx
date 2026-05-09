import * as React from "react";
import Link from "next/link";
import { Cassette, CassetteStats, Chip, Eyebrow, Icon, Btn, Frame } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { EnvMisconfigBanner } from "@/components/dashboard/env-misconfig-banner";

type Supabase = ReturnType<typeof import("@/lib/supabase/server").createClient>;

export async function SuperAdminDashboard({
  supabase,
  userName,
}: {
  supabase: Supabase;
  userName: string;
}) {
  const [{ count: orgCount }, { count: userCount }, { count: programCount }, { count: subCount }] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("programs").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const { data: tokenAgg } = await supabase
    .from("usage_logs")
    .select("prompt_tokens, completion_tokens")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());

  const totalPrompt = tokenAgg?.reduce((a, r) => a + (r.prompt_tokens ?? 0), 0) ?? 0;
  const totalCompletion = tokenAgg?.reduce((a, r) => a + (r.completion_tokens ?? 0), 0) ?? 0;
  const totalTokens = totalPrompt + totalCompletion;

  const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n));

  const stats = [
    { k: "ORGANIZATIONS", v: String(orgCount ?? 0) },
    { k: "USERS", v: fmt(userCount ?? 0) },
    { k: "CHATRAILS", v: String(programCount ?? 0) },
    { k: "ACTIVE SUBS", v: String(subCount ?? 0) },
  ];

  const stats2 = [
    { k: "TOKEN USAGE 30D", v: fmt(totalTokens) },
    { k: "PROMPT", v: fmt(totalPrompt) },
    { k: "COMPLETION", v: fmt(totalCompletion) },
    { k: "MRR", v: "—" },
  ];

  return (
    <div className="cq-page">
      <EnvMisconfigBanner />
      <Frame style={{ padding: 28, marginBottom: 24, position: "relative" }}>
        <div className="cq-cassette__corner">
          <Icon name="lock" size={10} /> PLATFORM
        </div>
        <div className="cq-mono" style={{ fontSize: 18, marginBottom: 12 }}>{bin(2, 8)}</div>
        <h1 className="cq-title-l" style={{ marginBottom: 8 }}>
          PLATFORM CONTROL.
        </h1>
        <div className="cq-mono" style={{ fontSize: 14, marginBottom: 20, color: "var(--muted)" }}>
          SUPER ADMIN: {userName.toUpperCase()}
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
      </Frame>

      <Frame style={{ padding: 28, marginBottom: 24 }}>
        <Eyebrow>USAGE · LAST 30 DAYS</Eyebrow>
        <div className="cq-grid cq-grid--4" style={{ marginTop: 12, gap: 0, border: "var(--hair) solid var(--ink)" }}>
          {stats2.map((s, i) => (
            <div
              key={s.k}
              style={{
                padding: 18,
                borderRight: i < stats2.length - 1 ? "var(--hair) solid var(--ink)" : "0",
              }}
            >
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                {s.k}
              </div>
              <div className="cq-title-l" style={{ fontSize: 28 }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </Frame>

      <div className="row" style={{ gap: 8 }}>
        <Btn sm asChild>
          <Link href="/admin/orgs"><Icon name="grid" /> ORGS</Link>
        </Btn>
        <Btn sm ghost asChild>
          <Link href="/admin/users"><Icon name="user" /> USERS</Link>
        </Btn>
        <Btn sm ghost asChild>
          <Link href="/admin/usage"><Icon name="settings" /> USAGE</Link>
        </Btn>
      </div>
    </div>
  );
}
