"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { generateChatrailFromPrompt } from "./actions";

const MIN_LENGTH = 20;

export function GenerateChatrailForm() {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState("");
  // Default to Haiku — it produces a great Chatrail in ~5–10s vs Sonnet's
  // 25–45s, and the latter often bumped against Netlify's Lambda timeout
  // for 7-node plans. Creators can opt up to Sonnet or Gemini 3 Pro for
  // deeper drafts, or pick Gemini 3 Flash for the cheapest path.
  type DesignerModel =
    | "claude-haiku-4-5"
    | "claude-sonnet-4-6"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gemini-3-flash-preview"
    | "gemini-3-pro-preview"
    | "gemini-flash-latest";
  const [model, setModel] = React.useState<DesignerModel>("claude-haiku-4-5");
  const [pending, setPending] = React.useState(false);
  const [progress, setProgress] = React.useState<string>("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Wire up the example cards: clicking one populates the textarea.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(".cq-example-card");
      if (!target) return;
      const value = target.getAttribute("data-example-prompt");
      if (!value) return;
      setPrompt(value);
      // Scroll the textarea into view + focus so the creator can edit
      // immediately. Defer one tick so the state update has flushed.
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Soft progress feedback during generation. The action is one round-trip
  // server-side but it can take 15–40s for Sonnet on a 7-node plan, so we
  // tick through some friendly status messages so the page doesn't feel
  // frozen.
  React.useEffect(() => {
    if (!pending) {
      setProgress("");
      return;
    }
    const messages = [
      "Sketching the curriculum…",
      "Drafting bot personas…",
      "Writing system prompts…",
      "Tuning models + token budgets…",
      "Stitching the path together…",
      "Almost there…",
    ];
    let idx = 0;
    setProgress(messages[0]);
    const interval = window.setInterval(() => {
      idx = Math.min(idx + 1, messages.length - 1);
      setProgress(messages[idx]);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [pending]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (prompt.trim().length < MIN_LENGTH) {
      toast.error(`At least ${MIN_LENGTH} characters, please.`);
      return;
    }
    setPending(true);
    try {
      const res = await generateChatrailFromPrompt({ prompt: prompt.trim(), model });
      if (!res.ok) {
        setPending(false);
        toast.error(res.error);
        return;
      }
      toast.success(`Generated ${res.nodeCount} nodes — opening the new Chatrail.`);
      // Don't reset pending — we're navigating away.
      router.push(`/programs/${res.programId}`);
      router.refresh();
    } catch (err: unknown) {
      // Netlify Lambda timeout, network blip, or any uncaught throw lands
      // here. Without this, the await rejects and onSubmit unwinds without
      // resetting `pending` — the user sees the spinner stuck and assumes
      // "nothing happened."
      const msg = err instanceof Error ? err.message : "Generator failed";
      const friendlier = /timeout|aborted|fetch failed|504|502/i.test(msg)
        ? "The generator took too long to respond. Try again with a shorter prompt or pick the faster Haiku model."
        : msg;
      console.error("[generate] action threw:", err);
      setPending(false);
      toast.error(friendlier);
    }
  }

  const charsLeft = 4000 - prompt.length;
  const tooShort = prompt.trim().length < MIN_LENGTH;

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
          placeholder="Example: A 5-node Chatrail introducing Stoic philosophy to undergraduates. Mix of Socratic discussion bots, a debate bot, a reflective coach, and a final assessment bot…"
          rows={8}
          disabled={pending}
          style={{
            width: "100%",
            padding: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            lineHeight: 1.6,
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
            resize: "vertical",
            minHeight: 180,
          }}
        />
        <div
          className="cq-mono"
          style={{
            position: "absolute",
            bottom: 8,
            right: 12,
            fontSize: 11,
            color: charsLeft < 200 ? "var(--ink)" : "var(--muted)",
          }}
        >
          {charsLeft} CHARS LEFT
        </div>
      </div>

      <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label className="cq-mono" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          DESIGNER MODEL
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as DesignerModel)}
            disabled={pending}
            className="cq-select"
            style={{ minWidth: 260 }}
          >
            <optgroup label="Anthropic Claude">
              <option value="claude-haiku-4-5">claude-haiku-4-5 (default — ~5–10s)</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6 (deeper drafts — ~25–40s)</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="gpt-4o-mini">gpt-4o-mini (cheap, fast)</option>
              <option value="gpt-4o">gpt-4o (alternative)</option>
            </optgroup>
            <optgroup label="Google Gemini">
              <option value="gemini-3-flash-preview">gemini-3-flash-preview (fast)</option>
              <option value="gemini-3-pro-preview">gemini-3-pro-preview (deepest)</option>
              <option value="gemini-flash-latest">gemini-flash-latest (auto-tracking)</option>
            </optgroup>
          </select>
        </label>
        <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          (this is the model that DESIGNS the Chatrail — each generated bot can use a different model)
        </span>
      </div>

      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn type="submit" disabled={pending || tooShort}>
          {pending ? "GENERATING…" : "GENERATE CHATRAIL"} <Icon name="arrow" />
        </Btn>
        {pending && progress ? (
          <Chip ghost>
            <span className="cq-square" style={{ marginRight: 6 }} /> {progress}
          </Chip>
        ) : null}
        {tooShort && prompt.length > 0 ? (
          <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {MIN_LENGTH - prompt.trim().length} more character
            {MIN_LENGTH - prompt.trim().length === 1 ? "" : "s"} please.
          </span>
        ) : null}
      </div>
    </form>
  );
}
