"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { createRubric } from "../actions";

export function NewRubricForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await createRubric(fd);
      if (res && !res.ok) setError(res.error);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NEXT_REDIRECT")) throw err;
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      <div className="cq-field">
        <label htmlFor="name">Rubric name</label>
        <input
          id="name"
          name="name"
          required
          className="cq-input"
          placeholder="AI Ethics — 4 criteria"
        />
      </div>
      <div className="cq-field">
        <label htmlFor="description">Description (optional)</label>
        <textarea
          id="description"
          name="description"
          className="cq-textarea"
          placeholder="What this rubric measures + when to use it."
        />
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "CREATING…" : "CREATE + EDIT CRITERIA"} <Icon name="arrow" />
        </Btn>
      </div>
    </form>
  );
}
