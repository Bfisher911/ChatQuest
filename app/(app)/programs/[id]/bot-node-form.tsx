"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { createBotNode, updateBotNode } from "../actions";

export interface BotNodeFormProps {
  programId: string;
  mode: "create" | "edit";
  node?: {
    id: string;
    title: string;
    points: number;
    chatbot_configs: {
      system_prompt: string;
      learner_instructions: string | null;
      model: string;
      temperature: string | number;
      token_budget: number;
      max_tokens: number;
      attempts_allowed: number;
    } | null;
  };
}

export function BotNodeForm({ programId, mode, node }: BotNodeFormProps) {
  const cfg = node?.chatbot_configs;
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    fd.set("programId", programId);
    if (mode === "edit" && node) fd.set("nodeId", node.id);
    const res = mode === "create" ? await createBotNode(fd) : await updateBotNode(fd);
    setPending(false);
    if (res && !res.ok) {
      setError(res.error);
    } else if (mode === "edit") {
      setSuccess("Saved.");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      {success ? <div className="cq-form-success">{success}</div> : null}

      <div className="cq-field">
        <label htmlFor="title">Bot title</label>
        <input id="title" name="title" required defaultValue={node?.title} className="cq-input" placeholder="AI Policy Advisor" />
      </div>

      <div className="cq-field">
        <label htmlFor="learnerInstructions">Learner-facing instructions</label>
        <textarea
          id="learnerInstructions"
          name="learnerInstructions"
          className="cq-textarea"
          defaultValue={cfg?.learner_instructions ?? ""}
          placeholder="What the learner should accomplish in this conversation."
        />
      </div>

      <div className="cq-field">
        <label htmlFor="systemPrompt">System prompt</label>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          className="cq-textarea"
          required
          minLength={10}
          rows={6}
          defaultValue={cfg?.system_prompt ?? "You are a Socratic policy advisor. Probe assumptions. Demand citations. Reference the program knowledge base before answering."}
        />
      </div>

      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="model">Model</label>
          <select id="model" name="model" defaultValue={cfg?.model ?? "claude-haiku-4-5"} className="cq-select">
            <optgroup label="Anthropic">
              <option value="claude-haiku-4-5">claude-haiku-4-5</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
              <option value="claude-opus-4-7">claude-opus-4-7</option>
              <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
              <option value="claude-3-5-haiku-latest">claude-3-5-haiku-latest</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
              <option value="gpt-4.1">gpt-4.1</option>
            </optgroup>
            <optgroup label="Google Gemini">
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            </optgroup>
          </select>
        </div>
        <div className="cq-field">
          <label htmlFor="temperature">Temperature</label>
          <input id="temperature" name="temperature" type="number" step="0.05" min={0} max={1}
            defaultValue={Number(cfg?.temperature ?? 0.4)} className="cq-input" />
        </div>
        <div className="cq-field">
          <label htmlFor="tokenBudget">Token budget (per attempt)</label>
          <input id="tokenBudget" name="tokenBudget" type="number" min={500}
            defaultValue={cfg?.token_budget ?? 8000} className="cq-input" />
        </div>
        <div className="cq-field">
          <label htmlFor="maxTokens">Max tokens per response</label>
          <input id="maxTokens" name="maxTokens" type="number" min={64}
            defaultValue={cfg?.max_tokens ?? 1024} className="cq-input" />
        </div>
        <div className="cq-field">
          <label htmlFor="attemptsAllowed">Attempts allowed</label>
          <input id="attemptsAllowed" name="attemptsAllowed" type="number" min={1}
            defaultValue={cfg?.attempts_allowed ?? 2} className="cq-input" />
        </div>
        <div className="cq-field">
          <label htmlFor="points">Points</label>
          <input id="points" name="points" type="number" min={0}
            defaultValue={node?.points ?? 25} className="cq-input" />
        </div>
      </div>

      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "SAVING…" : mode === "create" ? "CREATE BOT" : "SAVE CHANGES"} <Icon name="arrow" />
        </Btn>
      </div>
    </form>
  );
}
