"use client";

import * as React from "react";
import { Btn, Chip, Eyebrow, Icon } from "@/components/brutalist";
import { cx } from "@/lib/utils/cx";
import { toast } from "sonner";

type PreviewMessage = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

/**
 * Inline ephemeral preview chat for the bot-node editor.
 *
 * No DB writes — every message lives in component state and disappears on
 * reset / navigation. Hits /api/chat/preview which honors the same KB
 * retrieval, system-prompt build, and token budget gates as the real
 * learner endpoint, but doesn't create a conversation row.
 *
 * Usage tokens still log against the org so creators can see preview
 * cost in analytics.
 */
export function PreviewChatPanel({
  nodeId,
  hasUnsavedChanges,
}: {
  nodeId: string;
  hasUnsavedChanges?: boolean;
}) {
  const [messages, setMessages] = React.useState<PreviewMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [tokensUsed, setTokensUsed] = React.useState(0);
  // Listen for dirty-state broadcasts from BotNodeForm so the panel can
  // warn that preview uses last-saved config, not unsaved edits.
  const [siblingDirty, setSiblingDirty] = React.useState(false);
  const streamRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages]);

  React.useEffect(() => {
    function onDirty(e: Event) {
      const ce = e as CustomEvent<{ dirty?: boolean }>;
      if (typeof ce.detail?.dirty === "boolean") setSiblingDirty(ce.detail.dirty);
    }
    window.addEventListener("cq-bot-form-dirty", onDirty);
    return () => window.removeEventListener("cq-bot-form-dirty", onDirty);
  }, []);

  const showWarning = hasUnsavedChanges || siblingDirty;

  function reset() {
    setMessages([]);
    setTokensUsed(0);
    setDraft("");
  }

  async function send() {
    if (!draft.trim() || pending) return;
    const text = draft.trim();
    setDraft("");
    setPending(true);

    // Snapshot history excluding the streaming placeholder we're about to add.
    const historyForServer = messages
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/chat/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, history: historyForServer, message: text }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      readLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (event === "delta" && typeof parsed.delta === "string") {
              setMessages((curr) => {
                const next = [...curr];
                const last = next[next.length - 1];
                if (last?.role === "assistant" && last.streaming) {
                  next[next.length - 1] = { ...last, content: last.content + parsed.delta };
                }
                return next;
              });
            } else if (event === "done") {
              setMessages((curr) => {
                const next = [...curr];
                const last = next[next.length - 1];
                if (last?.role === "assistant" && last.streaming) {
                  next[next.length - 1] = { ...last, streaming: false };
                }
                return next;
              });
              if (parsed.promptTokens || parsed.completionTokens) {
                setTokensUsed((t) => t + (parsed.promptTokens ?? 0) + (parsed.completionTokens ?? 0));
              }
              break readLoop;
            } else if (event === "error") {
              throw new Error(parsed.error || "Stream error");
            }
          } catch (err) {
            console.error("[preview] parse:", err);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Preview failed";
      toast.error(msg);
      setMessages((curr) => curr.filter((m) => !m.streaming));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="cq-frame"
      style={{
        padding: 0,
        marginTop: 24,
        display: "flex",
        flexDirection: "column",
        minHeight: 480,
      }}
    >
      <div
        className="row-between"
        style={{
          padding: "12px 16px",
          borderBottom: "var(--hair) solid var(--ink)",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <Eyebrow>PREVIEW</Eyebrow>
          <Chip ghost>EPHEMERAL · NOT SAVED</Chip>
          {tokensUsed > 0 ? (
            <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {(tokensUsed / 1000).toFixed(1)}K TOKENS
            </span>
          ) : null}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Btn
            sm
            ghost
            onClick={reset}
            disabled={pending || messages.length === 0}
            title="Clear the preview transcript"
          >
            <Icon name="x" /> RESET
          </Btn>
        </div>
      </div>

      {showWarning ? (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "var(--hair) solid var(--ink)",
            background: "var(--soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          ■ You have unsaved changes. The preview is using the <strong>last saved</strong> bot
          config — save first to test your edits.
        </div>
      ) : null}

      <div
        ref={streamRef}
        style={{
          flex: 1,
          padding: 16,
          minHeight: 280,
          maxHeight: 480,
          overflowY: "auto",
          background: "var(--paper)",
        }}
      >
        {messages.length === 0 ? (
          <div
            className="cq-mono"
            style={{
              color: "var(--muted)",
              textAlign: "center",
              padding: "40px 20px",
              fontSize: 13,
            }}
          >
            Send a message to test this bot. Nothing here gets saved.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cx("cq-msg", m.role === "assistant" ? "cq-msg--bot" : "cq-msg--me")}
              style={{ marginBottom: 12 }}
            >
              <div className="cq-msg__head">
                <span>■ {m.role === "assistant" ? "BOT" : "YOU"}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {m.content}
                {m.streaming ? <span style={{ opacity: 0.5 }}>▍</span> : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div
        className="row"
        style={{
          padding: 12,
          borderTop: "var(--hair) solid var(--ink)",
          gap: 8,
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Test the bot with a learner-style message…"
          disabled={pending}
          rows={2}
          style={{
            flex: 1,
            padding: "8px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            border: "var(--hair) solid var(--ink)",
            background: "var(--paper)",
            resize: "vertical",
          }}
        />
        <Btn onClick={send} disabled={pending || !draft.trim()}>
          {pending ? "…" : "SEND"} <Icon name="send" />
        </Btn>
      </div>
    </div>
  );
}
