"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";

export function DeleteAccountForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");

  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm !== "DELETE MY ACCOUNT") {
      toast.error("Type the phrase exactly to confirm.");
      return;
    }
    if (!window.confirm("Last chance — really delete your account?")) return;
    setPending(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error || "Delete failed");
      return;
    }
    toast.success("Account deleted.");
    router.push("/");
  }

  return (
    <form onSubmit={go} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="cq-field">
        <label htmlFor="confirm">Type DELETE MY ACCOUNT to confirm</label>
        <input
          id="confirm"
          className="cq-input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE MY ACCOUNT"
        />
      </div>
      <Btn type="submit" disabled={pending}>
        {pending ? "DELETING…" : "DELETE ACCOUNT"} <Icon name="trash" />
      </Btn>
    </form>
  );
}
