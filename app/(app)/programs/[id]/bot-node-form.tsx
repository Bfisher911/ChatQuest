"use client";

import * as React from "react";
import Link from "next/link";
import { Btn, Chip, Icon } from "@/components/brutalist";
import { createBotNode, updateBotNode } from "../actions";
import { estimateCostUsd } from "@/lib/llm/cost";

export interface BotNodeFormProps {
  programId: string;
  mode: "create" | "edit";
  rubrics: { id: string; name: string; total_points: number | null }[];
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
      rubric_id: string | null;
      use_program_kb?: boolean | null;
      ai_grading_enabled?: boolean | null;
    } | null;
  };
}

export function BotNodeForm({ programId, mode, rubrics, node }: BotNodeFormProps) {
  const cfg = node?.chatbot_configs;
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  // Track dirty state so the inline preview panel can warn the creator
  // they're testing the LAST SAVED config, not their unsaved edits.
  const [dirty, setDirty] = React.useState(false);
  // Mirror cost-relevant inputs into state so we can compute a live cost
  // estimate without making each input fully controlled.
  // New bots default to gemini-3-flash — fast + cheap + currently the
  // recommended Gemini chat model. Existing bots keep whatever model
  // they were saved with.
  const [model, setModel] = React.useState<string>(cfg?.model ?? "gemini-3-flash");
  const [tokenBudget, setTokenBudget] = React.useState<number>(cfg?.token_budget ?? 8000);
  const [attemptsAllowed, setAttemptsAllowed] = React.useState<number>(cfg?.attempts_allowed ?? 2);

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
      setDirty(false);
    }
  }

  // Warn before nav if the creator has unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Broadcast dirty state to the sibling PreviewChatPanel via a window
  // CustomEvent — avoids needing to lift state into a parent client wrapper.
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("cq-bot-form-dirty", { detail: { dirty } }));
  }, [dirty]);

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => {
        if (!dirty) setDirty(true);
      }}
      data-dirty={dirty || undefined}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
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

      {/* Always-visible essentials: model + attempts + points. Power-user
          dials (temperature / token budget / max tokens / cost estimate)
          live in the Advanced expander below — most creators never touch
          them, and exposing them up front made the form feel intimidating. */}
      <div className="cq-grid cq-grid--3" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="model">Model</label>
          <select id="model" name="model" value={model} onChange={(e) => setModel(e.target.value)} className="cq-select">
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
              <option value="gemini-3-pro">gemini-3-pro</option>
              <option value="gemini-3-flash">gemini-3-flash (recommended)</option>
              <option value="gemini-3-flash-lite">gemini-3-flash-lite</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
            </optgroup>
          </select>
        </div>
        <div className="cq-field">
          <label htmlFor="attemptsAllowed">Attempts allowed</label>
          <input
            id="attemptsAllowed"
            name="attemptsAllowed"
            type="number"
            min={1}
            value={attemptsAllowed}
            onChange={(e) => setAttemptsAllowed(Number(e.target.value) || 0)}
            className="cq-input"
          />
        </div>
        <div className="cq-field">
          <label htmlFor="points">Points</label>
          <input id="points" name="points" type="number" min={0}
            defaultValue={node?.points ?? 25} className="cq-input" />
        </div>
      </div>

      {/* Advanced — collapsed by default. Uses native <details> so it
          works without JS and respects keyboard navigation. */}
      <details className="cq-advanced" style={{ marginTop: 4 }}>
        <summary
          style={{
            cursor: "pointer",
            padding: "10px 12px",
            border: "var(--hair) solid var(--line)",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--paper)",
            userSelect: "none",
            listStyle: "none",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRight: "2px solid currentColor",
              borderBottom: "2px solid currentColor",
              transform: "rotate(-45deg)",
              transition: "transform 0.15s ease",
              marginLeft: 2,
            }}
            className="cq-advanced__caret"
          />
          Advanced — model temperature, token budget, cost estimate
        </summary>
        <div
          style={{
            padding: "16px 4px 4px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div className="cq-grid cq-grid--3" style={{ gap: 12 }}>
            <div className="cq-field">
              <label htmlFor="temperature">Temperature</label>
              <input id="temperature" name="temperature" type="number" step="0.05" min={0} max={1}
                defaultValue={Number(cfg?.temperature ?? 0.4)} className="cq-input" />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                0.0 = focused / 0.4 = balanced (default) / 0.7 = creative
              </div>
            </div>
            <div className="cq-field">
              <label htmlFor="tokenBudget">Token budget per attempt</label>
              <input
                id="tokenBudget"
                name="tokenBudget"
                type="number"
                min={500}
                value={tokenBudget}
                onChange={(e) => setTokenBudget(Number(e.target.value) || 0)}
                className="cq-input"
              />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Hard cap. Hits 80% → soft warn, 100% → blocked.
              </div>
            </div>
            <div className="cq-field">
              <label htmlFor="maxTokens">Max tokens per response</label>
              <input id="maxTokens" name="maxTokens" type="number" min={64}
                defaultValue={cfg?.max_tokens ?? 1024} className="cq-input" />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Per-turn limit. 1024 covers ~750 words.
              </div>
            </div>
          </div>
          <CostEstimate model={model} tokenBudget={tokenBudget} attemptsAllowed={attemptsAllowed} />
        </div>
      </details>

      <div className="cq-field">
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            cursor: "pointer",
            padding: "10px 12px",
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
          }}
        >
          <input
            type="checkbox"
            name="useProgramKb"
            defaultChecked={cfg?.use_program_kb ?? true}
            style={{ marginTop: 3 }}
          />
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>
              Use program knowledge base
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 4,
              }}
            >
              On every learner turn, retrieve top-k relevant chunks from this
              Chatrail&apos;s KB collection and inject them into the bot&apos;s context.
              Disable for free-form bots that don&apos;t need source-grounding.
            </div>
          </div>
        </label>
      </div>

      <div className="cq-field">
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            cursor: "pointer",
            padding: "10px 12px",
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
          }}
        >
          <input
            type="checkbox"
            name="aiGradingEnabled"
            defaultChecked={cfg?.ai_grading_enabled ?? true}
            style={{ marginTop: 3 }}
          />
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>
              AI grading suggestion on submit
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 4,
              }}
            >
              On submit, summarize the conversation and suggest a per-criterion
              rubric score so the instructor opens the grader panel pre-filled.
              Disable to skip the AI summary call entirely (saves tokens, but
              the grader sees a blank panel).
            </div>
          </div>
        </label>
      </div>

      <div className="cq-field">
        <label htmlFor="rubricId">Rubric (for AI grading)</label>
        <select
          id="rubricId"
          name="rubricId"
          defaultValue={cfg?.rubric_id ?? ""}
          className="cq-select"
        >
          <option value="">— None —</option>
          {rubrics.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.total_points ?? 0} pts)
            </option>
          ))}
        </select>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {rubrics.length === 0 ? (
            <>
              No rubrics yet. <Link href="/rubrics/new" style={{ textDecoration: "underline" }}>Create one</Link> for AI-suggested scores.
            </>
          ) : (
            <>
              Manage at <Link href="/rubrics" style={{ textDecoration: "underline" }}>/rubrics</Link>
            </>
          )}
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

/**
 * Live cost estimate for the current model + token-budget + attempts combo.
 *
 * The cost helper is per-million-tokens and split prompt vs completion. Real
 * conversations use both, so we model a 70/30 split which is broadly
 * accurate for instruction-following chat (heavier on prompt + KB context).
 *
 * Shows two numbers: per-attempt cost and per-learner total assuming all
 * attempts are used. Both are upper-bound — real usage is typically lower
 * because conversations end before the budget is exhausted.
 */
function CostEstimate({
  model,
  tokenBudget,
  attemptsAllowed,
}: {
  model: string;
  tokenBudget: number;
  attemptsAllowed: number;
}) {
  const promptShare = Math.round(tokenBudget * 0.7);
  const completionShare = tokenBudget - promptShare;
  const perAttempt = estimateCostUsd(model, promptShare, completionShare);
  const perLearner = perAttempt * Math.max(1, attemptsAllowed);
  const fmt = (n: number) =>
    n < 0.01 ? "<$0.01" : n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
  const isFree = perAttempt === 0; // unknown model in COST_PER_M_TOKENS

  return (
    <div
      style={{
        padding: 12,
        border: "var(--hair) solid var(--ink)",
        background: "var(--soft)",
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <Chip ghost>EST. COST</Chip>
      {isFree ? (
        <span className="cq-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          Pricing for <strong>{model}</strong> not in cost table — usage is still
          tracked but the dollar estimate is unavailable.
        </span>
      ) : (
        <>
          <span className="cq-mono" style={{ fontSize: 12 }}>
            <strong>{fmt(perAttempt)}</strong> per attempt
          </span>
          <span className="cq-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            ·
          </span>
          <span className="cq-mono" style={{ fontSize: 12 }}>
            <strong>{fmt(perLearner)}</strong> per learner ({attemptsAllowed}{" "}
            {attemptsAllowed === 1 ? "attempt" : "attempts"})
          </span>
          <span
            className="cq-mono"
            style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}
          >
            Upper-bound · 70/30 prompt/completion split
          </span>
        </>
      )}
    </div>
  );
}
