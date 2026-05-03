import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eyebrow, Frame, Btn, Icon, Chip } from "@/components/brutalist";
import { getActiveRole } from "@/lib/auth/active-role";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");

  const memberCount = session.user.memberships.length;
  const roleSummary = session.user.isSuperAdmin
    ? "Super admin"
    : session.user.memberships.map((m) => m.role).join(" · ");

  return (
    <div className="cq-page" style={{ maxWidth: 760 }}>
      <Eyebrow>ACCOUNT</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        YOUR ACCOUNT.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        Update your profile, change your password, or export / delete your data.
      </p>

      <Frame style={{ padding: 20, marginBottom: 24 }}>
        <div className="cq-grid cq-grid--3" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          <Stat label="EMAIL" value={session.user.email} mono small />
          <Stat label="ROLE" value={roleSummary || "—"} />
          <Stat label="ORGS" value={String(memberCount)} last />
        </div>
      </Frame>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>PROFILE</Eyebrow>
        <ProfileForm
          initial={{
            fullName: session.user.fullName ?? "",
            displayName: session.user.displayName ?? "",
            email: session.user.email,
          }}
        />
      </Frame>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>PASSWORD</Eyebrow>
        <PasswordForm />
      </Frame>

      <Frame style={{ padding: 24 }}>
        <Eyebrow>DATA</Eyebrow>
        <p style={{ fontFamily: "var(--font-mono)", marginTop: 8, marginBottom: 16, color: "var(--muted)" }}>
          Download a JSON archive of everything your account has — profile,
          memberships, conversations, submissions, grades, certificates.
          Or permanently delete your account.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Btn sm asChild>
            <a href="/api/account/export" target="_blank" rel="noreferrer">
              <Icon name="download" /> EXPORT DATA
            </a>
          </Btn>
          <Btn sm ghost asChild>
            <Link href="/account/delete-account">
              <Icon name="trash" /> DELETE ACCOUNT
            </Link>
          </Btn>
        </div>
      </Frame>

      {session.user.memberships.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <Eyebrow>YOUR MEMBERSHIPS</Eyebrow>
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {session.user.memberships.map((m, i) => (
              <Chip key={i} ghost>
                {m.organizationName} · {m.role.toUpperCase()}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  small,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
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
      <div
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontWeight: mono ? 400 : 800,
          fontSize: small ? 14 : 18,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
