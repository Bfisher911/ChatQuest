"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { signUp } from "../actions";

// Two roles in the public signup: Creator and Learner.
// "Creator" maps to the existing instructor role on the backend (which auto-
// creates a workspace organization). org_admin / ta / super_admin are still
// in the schema for future enterprise + RBAC needs but aren't surfaced here.
const INTENTS = [
  { value: "instructor", label: "Creator (build Chatrails, invite learners)" },
  { value: "learner", label: "Learner (you've been invited or have a code)" },
];

export function SignupForm({ inviteToken, intent }: { inviteToken?: string; intent?: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [selectedIntent, setSelectedIntent] = React.useState(intent || "instructor");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    if (inviteToken) fd.set("inviteToken", inviteToken);
    fd.set("intent", selectedIntent);
    try {
      const res = await signUp(fd);
      // On success the server action throws NEXT_REDIRECT — we won't reach here.
      if (res && !res.ok) {
        setError(res.error);
      }
    } catch (err) {
      // Don't swallow the framework's redirect signal.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NEXT_REDIRECT")) throw err;
      setError(msg || "Unexpected error during signup.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      {!inviteToken ? (
        <div className="cq-field">
          <label htmlFor="intent">I am a…</label>
          <select
            id="intent"
            name="intent"
            value={selectedIntent}
            onChange={(e) => setSelectedIntent(e.target.value)}
            className="cq-select"
          >
            {INTENTS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="cq-form-success">JOINING WITH INVITE TOKEN</div>
      )}
      <div className="cq-field">
        <label htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" required className="cq-input" autoComplete="name" />
      </div>
      <div className="cq-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="cq-input" autoComplete="email" />
      </div>
      <div className="cq-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} className="cq-input" autoComplete="new-password" />
      </div>
      {selectedIntent === "instructor" && !inviteToken ? (
        <div className="cq-field">
          <label htmlFor="organizationName">Workspace name (optional)</label>
          <input
            id="organizationName"
            name="organizationName"
            className="cq-input"
            placeholder="e.g. your school, company, or your name"
          />
        </div>
      ) : null}
      <Btn type="submit" disabled={pending}>
        {pending ? "CREATING…" : "CREATE ACCOUNT"} <Icon name="arrow" />
      </Btn>
    </form>
  );
}
