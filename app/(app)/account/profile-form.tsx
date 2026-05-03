"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { updateProfile } from "./actions";

export function ProfileForm({
  initial,
}: {
  initial: { fullName: string; displayName: string; email: string };
}) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(initial.fullName);
  const [displayName, setDisplayName] = React.useState(initial.displayName);
  const [pending, setPending] = React.useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await updateProfile({ fullName, displayName });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Profile saved.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            className="cq-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="cq-field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            className="cq-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="nickname"
            required
          />
        </div>
      </div>
      <div className="cq-field">
        <label htmlFor="email">Email (read-only)</label>
        <input id="email" className="cq-input" defaultValue={initial.email} disabled style={{ opacity: 0.6 }} />
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "SAVING…" : "SAVE PROFILE"} <Icon name="check" />
        </Btn>
      </div>
    </form>
  );
}
