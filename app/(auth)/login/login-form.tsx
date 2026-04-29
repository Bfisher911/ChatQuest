"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { signIn } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    if (next) fd.set("next", next);
    const res = await signIn(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(res.next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      <div className="cq-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="cq-input" autoComplete="email" />
      </div>
      <div className="cq-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="cq-input" autoComplete="current-password" />
      </div>
      <Btn type="submit" disabled={pending}>
        {pending ? "SIGNING IN…" : "SIGN IN"} <Icon name="arrow" />
      </Btn>
    </form>
  );
}
