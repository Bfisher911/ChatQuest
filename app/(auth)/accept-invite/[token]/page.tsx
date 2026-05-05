import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { Eyebrow, Btn, Chip } from "@/components/brutalist";
import { ClaimInvitePanel } from "./claim-panel";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createServiceRoleClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, email, role, status, expires_at, organization_id, program_id, organizations(name), programs(title)")
    .eq("token", params.token)
    .maybeSingle();

  if (!invite) {
    return (
      <div className="cq-auth">
        <div className="cq-auth__form">
          <Eyebrow>■ INVITE</Eyebrow>
          <h1 className="cq-title-l" style={{ marginTop: 12 }}>
            INVITE NOT FOUND.
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", marginTop: 12 }}>
            This link may have been already used, revoked, or it doesn&apos;t exist.
          </p>
          <div style={{ marginTop: 20 }}>
            <Btn asChild>
              <Link href="/login">SIGN IN INSTEAD</Link>
            </Btn>
          </div>
        </div>
        <div className="cq-auth__art">
          <Eyebrow>■ 404 · INVITE</Eyebrow>
        </div>
      </div>
    );
  }

  if (invite.status !== "pending" || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="cq-auth">
        <div className="cq-auth__form">
          <Eyebrow>■ INVITE</Eyebrow>
          <h1 className="cq-title-l" style={{ marginTop: 12 }}>
            INVITE EXPIRED OR USED.
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", marginTop: 12 }}>
            Ask your organization admin or instructor to send a new one.
          </p>
        </div>
        <div className="cq-auth__art">
          <Eyebrow>■ 410 · INVITE</Eyebrow>
        </div>
      </div>
    );
  }

  // Already signed in? Surface a "claim for this account" panel instead of
  // forcing a re-signup. Email-mismatch case is handled in the panel.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type OrgRef = { name: string } | { name: string }[] | null;
  type ProgRef = { title: string } | { title: string }[] | null;
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;
  const orgName = pickOne((invite as unknown as { organizations: OrgRef }).organizations)?.name;
  const programTitle = pickOne((invite as unknown as { programs: ProgRef }).programs)?.title;

  if (user) {
    const emailMatches =
      (user.email ?? "").toLowerCase() === invite.email.toLowerCase();
    return (
      <div className="cq-auth">
        <div className="cq-auth__form">
          <Eyebrow>■ INVITE READY</Eyebrow>
          <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
            YOU&apos;RE INVITED.
          </h1>
          <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <Chip>{invite.role.toUpperCase()}</Chip>
            {orgName ? <Chip ghost>{orgName.toUpperCase()}</Chip> : null}
            {programTitle ? <Chip ghost>{programTitle.toUpperCase()}</Chip> : null}
          </div>
          <ClaimInvitePanel
            token={params.token}
            inviteEmail={invite.email}
            currentEmail={user.email ?? ""}
            emailMatches={emailMatches}
            programTitle={programTitle ?? null}
          />
        </div>
        <div className="cq-auth__art">
          <Eyebrow>■ INVITE</Eyebrow>
        </div>
      </div>
    );
  }

  // Logged-out: jump to signup with the invite token + intent pre-filled.
  // The signup action consumes the invite in the same transaction.
  const queryParams = new URLSearchParams({ token: params.token, intent: invite.role });
  redirect(`/signup?${queryParams.toString()}`);
}
