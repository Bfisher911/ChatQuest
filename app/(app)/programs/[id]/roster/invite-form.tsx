"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Icon } from "@/components/brutalist";
import { inviteLearner } from "./actions";
import { toast } from "sonner";

export function InviteForm({ programId }: { programId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  // Surface the invite URL as a copyable artifact instead of in a toast —
  // creators frequently need the link to share manually when email delivery
  // is unreliable (corp filters, missing Resend key, etc.).
  const [lastInviteUrl, setLastInviteUrl] = React.useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fall back to a manual selection prompt — some browsers refuse
      // clipboard writes outside a user gesture or in iframes.
      window.prompt("Copy this invite link:", lastInviteUrl);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const emailRaw = fd.get("email");
    const email = typeof emailRaw === "string" ? emailRaw : "";
    fd.set("programId", programId);
    const res = await inviteLearner(fd);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if ("addedExistingUser" in res && res.addedExistingUser) {
      toast.success("Existing user added to the program.");
      setLastInviteUrl(null);
      setLastInviteEmail(null);
    } else if ("inviteUrl" in res && res.inviteUrl) {
      toast.success("Invite sent. Link ready to copy below.");
      setLastInviteUrl(res.inviteUrl);
      setLastInviteEmail(email || null);
    } else {
      toast.success("Invite created.");
    }
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="cq-field" style={{ flex: 1, minWidth: 240 }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="cq-input" />
        </div>
        <div className="cq-field" style={{ width: 160 }}>
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="learner" className="cq-select">
            <option value="learner">Learner</option>
            <option value="ta">TA</option>
            <option value="instructor">Co-Instructor</option>
          </select>
        </div>
        <Btn type="submit" disabled={pending}>
          {pending ? "SENDING…" : "INVITE"} <Icon name="send" />
        </Btn>
      </form>

      {lastInviteUrl ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "var(--hair) solid var(--ink)",
            background: "var(--soft)",
          }}
        >
          <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <Chip>INVITE READY</Chip>
            {lastInviteEmail ? (
              <span className="cq-mono" style={{ fontSize: 12 }}>
                FOR · {lastInviteEmail}
              </span>
            ) : null}
            <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              email queued · share manually if it doesn&apos;t arrive
            </span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
            <input
              readOnly
              value={lastInviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="cq-input"
              style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <Btn sm onClick={copy}>
              {copied ? "COPIED!" : "COPY"} <Icon name={copied ? "check" : "link"} />
            </Btn>
            <Btn
              sm
              ghost
              onClick={() => {
                setLastInviteUrl(null);
                setLastInviteEmail(null);
              }}
              title="Dismiss"
            >
              <Icon name="x" />
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
