import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Frame, Btn, Icon, Chip } from "@/components/brutalist";
import { OrgSettingsForm } from "./settings-form";
import { BrandColorForm } from "./brand-color-form";

export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    redirect("/dashboard");
  }
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, org_type, plan_code, created_at, logo_url, accent_color")
    .eq("id", session.activeOrganizationId)
    .single();

  if (!org) redirect("/dashboard");

  // Quick stats.
  const [{ count: memberCount }, { count: programCount }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("is_active", true),
    supabase
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id),
  ]);

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Btn sm ghost asChild>
          <Link href="/dashboard">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> DASHBOARD
          </Link>
        </Btn>
        <Chip>{org.plan_code?.toUpperCase() ?? "FREE"}</Chip>
      </div>

      <Eyebrow>ORG SETTINGS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        {org.name.toUpperCase()}
      </h1>

      <Frame style={{ padding: 20, marginBottom: 24 }}>
        <div className="cq-grid cq-grid--3" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          <Stat label="MEMBERS" value={String(memberCount ?? 0)} />
          <Stat label="CHATRAILS" value={String(programCount ?? 0)} />
          <Stat
            label="CREATED"
            value={new Date(org.created_at).toISOString().slice(0, 10)}
            last
          />
        </div>
      </Frame>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>BASIC INFO</Eyebrow>
        <OrgSettingsForm
          org={{
            id: org.id,
            name: org.name,
            slug: org.slug,
            orgType: (org.org_type ?? "other") as "school" | "company" | "training" | "other",
          }}
        />
      </Frame>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>BRAND COLOR</Eyebrow>
        <p style={{ fontFamily: "var(--font-mono)", marginTop: 8, marginBottom: 4, color: "var(--muted)", fontSize: 12 }}>
          Pick the accent color used across the app for primary buttons,
          links, focus rings, and progress bars. Applies to every member
          in this org. Personal theme choice still controls everything else.
        </p>
        <BrandColorForm
          organizationId={org.id}
          initialAccent={(org.accent_color as string | null) ?? null}
        />
      </Frame>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>BRANDING</Eyebrow>
        <p style={{ fontFamily: "var(--font-mono)", marginTop: 8, marginBottom: 16, color: "var(--muted)" }}>
          Upload your logo + signature for certificate PDFs on the dedicated cert template page.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Btn sm asChild>
            <Link href="/org/cert-template">
              <Icon name="award" /> CERT TEMPLATE
            </Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href="/org/billing">
              <Icon name="settings" /> BILLING
            </Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href="/org/members">
              <Icon name="user" /> MEMBERS
            </Link>
          </Btn>
        </div>
      </Frame>
    </div>
  );
}

function Stat({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRight: last ? "0" : "var(--hair) solid var(--ink)",
      }}
    >
      <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="cq-title-m" style={{ fontSize: 22 }}>
        {value}
      </div>
    </div>
  );
}
