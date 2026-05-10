"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { updateProgram } from "../../actions";

interface Program {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  default_model: string | null;
  passing_threshold: string | number | null;
  monthly_token_budget: number | null;
  share_conversations_with_org_admin: boolean;
}

export function ProgramSettingsForm({ program }: { program: Program }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    fd.set("programId", program.id);
    const res = await updateProgram(fd);
    setPending(false);
    if (res && !res.ok) setError(res.error);
    else setSuccess("Saved.");
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      {success ? <div className="cq-form-success">{success}</div> : null}

      <div className="cq-field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required defaultValue={program.title} className="cq-input" />
      </div>
      <div className="cq-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          defaultValue={program.description ?? ""}
          className="cq-textarea"
        />
      </div>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={program.status ?? "draft"} className="cq-select">
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="cq-field">
          <label htmlFor="defaultModel">Default model</label>
          <select id="defaultModel" name="defaultModel" defaultValue={program.default_model ?? "gemini-3-flash-preview"} className="cq-select">
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
        <div className="cq-field">
          <label htmlFor="passingThreshold">Passing threshold (%)</label>
          <input
            id="passingThreshold"
            name="passingThreshold"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={Number(program.passing_threshold ?? 70)}
            className="cq-input"
          />
        </div>
        <div className="cq-field">
          <label htmlFor="monthlyTokenBudget">Monthly token budget</label>
          <input
            id="monthlyTokenBudget"
            name="monthlyTokenBudget"
            type="number"
            min={0}
            step={1000}
            defaultValue={program.monthly_token_budget ?? 200000}
            className="cq-input"
          />
        </div>
      </div>
      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            id="shareConversationsWithOrgAdmin"
            name="shareConversationsWithOrgAdmin"
            type="checkbox"
            defaultChecked={program.share_conversations_with_org_admin}
          />
          <span>Allow organization admins to view learner conversations</span>
        </label>
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "SAVING…" : "SAVE SETTINGS"} <Icon name="check" />
        </Btn>
      </div>
    </form>
  );
}
