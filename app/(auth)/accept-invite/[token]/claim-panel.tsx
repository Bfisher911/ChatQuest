"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { claimInviteForCurrentUser, signOut } from "@/app/(auth)/actions";

/**
 * The "claim for current account" path on the accept-invite page.
 *
 * When the signed-in user's email matches the invite, one button accepts
 * and routes them to the right destination. When it doesn't, we explain
 * the mismatch and offer a SIGN OUT button so they can sign back in with
 * the invited email.
 */
export function ClaimInvitePanel({
  token,
  inviteEmail,
  currentEmail,
  emailMatches,
  programTitle,
}: {
  token: string;
  inviteEmail: string;
  currentEmail: string;
  emailMatches: boolean;
  programTitle: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onAccept() {
    setPending(true);
    const res = await claimInviteForCurrentUser(token);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Invite accepted.");
    router.push(res.redirectTo);
    router.refresh();
  }

  if (!emailMatches) {
    return (
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6 }}>
          You are signed in as <strong>{currentEmail}</strong> but this invite
          was sent to <strong>{inviteEmail}</strong>. Sign out and either sign
          in with the invited email or accept this invite as a new account.
        </p>
        <div className="row" style={{ gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <form action={signOut}>
            <Btn type="submit">
              SIGN OUT <Icon name="arrow" />
            </Btn>
          </form>
          <Btn ghost asChild>
            <Link href="/dashboard">STAY SIGNED IN</Link>
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6 }}>
        You are signed in as <strong>{currentEmail}</strong>. Accept this invite
        to add {programTitle ? <span><strong>{programTitle}</strong> </span> : null}to your account.
      </p>
      <div className="row" style={{ gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn onClick={onAccept} disabled={pending}>
          {pending ? "ACCEPTING…" : "ACCEPT INVITE"} <Icon name="arrow" />
        </Btn>
        <Btn ghost asChild>
          <Link href="/dashboard">NOT NOW</Link>
        </Btn>
      </div>
    </div>
  );
}
