import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Eyebrow, Btn, Icon, Chip } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createServiceRoleClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, email, role, status, expires_at, organization_id, program_id, organizations(name)")
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

  const queryParams = new URLSearchParams({ token: params.token, intent: invite.role });

  // Logged-out: jump them to signup with the invite token pre-filled.
  // Logged-in users using a different email won't pass the email check on submit.
  redirect(`/signup?${queryParams.toString()}`);
}
