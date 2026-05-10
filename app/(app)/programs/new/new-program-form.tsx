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
        <select id="defaultModel" name="defaultModel" defaultValue="gemini-3-flash-preview" className="cq-select">
          <option value="gemini-3-flash-preview">gemini-3-flash-preview (recommended)</option>
          <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
          <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
          <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
          <option value="gemini-flash-latest">gemini-flash-latest (auto-tracking)</option>
          <option value="gemini-pro-latest">gemini-pro-latest (auto-tracking)</option>
          <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
          <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
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
