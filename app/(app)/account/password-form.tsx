"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await changePassword({ currentPassword, newPassword, confirmPassword });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Password changed.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <div className="cq-field">
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          type="password"
          className="cq-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            type="password"
            minLength={8}
            className="cq-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="cq-field">
          <label htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            minLength={8}
            className="cq-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "CHANGING…" : "CHANGE PASSWORD"} <Icon name="check" />
        </Btn>
      </div>
    </form>
  );
}
