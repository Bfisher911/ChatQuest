"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { inviteLearner } from "./actions";
import { toast } from "sonner";

export function InviteForm({ programId }: { programId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("programId", programId);
    const res = await inviteLearner(fd);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if ("addedExistingUser" in res && res.addedExistingUser) {
      toast.success("Existing user added to the program.");
    } else if ("inviteUrl" in res && res.inviteUrl) {
      toast.success(`Invite sent. Link: ${res.inviteUrl}`);
    } else {
      toast.success("Invite created.");
    }
    e.currentTarget.reset();
    router.refresh();
  }

  return (
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
  );
}
