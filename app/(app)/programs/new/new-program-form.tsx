"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { createProgram } from "../actions";

export function NewProgramForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createProgram(fd);
    setPending(false);
    if (res && !res.ok) setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      <div className="cq-field">
        <label htmlFor="title">Program title</label>
        <input id="title" name="title" required className="cq-input" placeholder="AI Ethics Simulation Path" />
      </div>
      <div className="cq-field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" className="cq-textarea" placeholder="What learners will learn." />
      </div>
      <div className="cq-field">
        <label htmlFor="defaultModel">Default chat model</label>
        <select id="defaultModel" name="defaultModel" defaultValue="claude-haiku-4-5" className="cq-select">
          <option value="claude-haiku-4-5">claude-haiku-4-5</option>
          <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
          <option value="claude-opus-4-7">claude-opus-4-7</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "CREATING…" : "CREATE PROGRAM"} <Icon name="arrow" />
        </Btn>
      </div>
    </form>
  );
}
