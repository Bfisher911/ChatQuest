"use client";

import * as React from "react";
import Link from "next/link";
import { Btn, Icon, Eyebrow } from "@/components/brutalist";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [state, setState] = React.useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await requestPasswordReset(fd);
    setPending(false);
    setState(res);
  }

  return (
    <div className="cq-auth">
      <div className="cq-auth__form">
        <Eyebrow>■ RESET · 00000011</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
          FORGOT PASSWORD.
        </h1>
        {state?.ok ? (
          <div className="cq-form-success">CHECK YOUR INBOX FOR A RESET LINK</div>
        ) : null}
        {state?.error ? <div className="cq-form-error">{state.error}</div> : null}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="cq-field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="cq-input" />
          </div>
          <Btn type="submit" disabled={pending}>
            {pending ? "SENDING…" : "SEND RESET LINK"} <Icon name="arrow" />
          </Btn>
        </form>
        <div style={{ marginTop: 20, fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <Link href="/login">← Back to sign in</Link>
        </div>
      </div>
      <div className="cq-auth__art">
        <div>
          <Eyebrow>■ FORGOT THE KEY?</Eyebrow>
          <h2>WE&apos;LL EMAIL YOU A NEW ONE.</h2>
        </div>
      </div>
    </div>
  );
}
