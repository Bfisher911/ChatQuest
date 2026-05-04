"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Btn, Chip, Eyebrow, Icon, IconBtn } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { cx } from "@/lib/utils/cx";
import { submitConversation } from "@/app/(app)/learn/actions";
import { toast } from "sonner";

export type Message = { id?: string; role: "user" | "assistant"; content: string; streaming?: boolean };

export interface ChatScreenProps {
  programId: string;
  programTitle: string;
  nodeId: string;
  conversationId: string;
  attempt: number;
  bot: {
    name: string;
    avatar: string;
    instructions: string;
    model: string;
    tokenBudget: number;
    attemptsAllowed: number;
  } | null;
  learnerName: string;
  initialMessages: Message[];
  pathNodes: {
    id: string;
    title: string;
    type: string;
    index: number;
    status: "DONE" | "ACTIVE" | "AVAILABLE" | "LOCKED";
  }[];
}

export function ChatScreen(props: ChatScreenProps) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>(props.initialMessages);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [tokensUsed, setTokensUsed] = React.useState(0);
  // When the server says we've hit a token budget (per-attempt or org-wide),
  // we stop accepting new messages and surface a banner with submit as the
  // only path forward — toast-and-keep-going produced confusing repeat errors.
  const [budgetExhausted, setBudgetExhausted] = React.useState<null | "attempt" | "monthly">(null);
  const streamRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!draft.trim() || pending) return;
    const text = draft.trim();
    setDraft("");
    setPending(true);

    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: props.conversationId, message: text }),
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
        // SSE frames are separated by blank lines.
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
            // ignore parse errors
            console.error("[chat] parse:", err);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Send failed";
      // Recognize budget-exhaustion errors and lock the composer instead of
      // letting the learner spam Send and rack up a stack of failure toasts.
      if (/monthly token budget/i.test(msg)) {
        setBudgetExhausted("monthly");
      } else if (/token budget for this attempt/i.test(msg)) {
        setBudgetExhausted("attempt");
      } else {
        toast.error(msg);
      }
      setMessages((curr) => curr.filter((m) => !m.streaming));
    } finally {
      setPending(false);
    }
  }

  async function onSubmit() {
    if (!confirm("Submit this conversation for grading? You can't edit it after submission.")) return;
    setPending(true);
    const res = await submitConversation(props.conversationId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSubmitted(true);
    toast.success("Submitted! Returning to your journey…");
    // Brief pause so the toast registers, then bounce back to the journey view
    // where the path-progress engine will pick the next available node + show
    // the "NEXT STEP" banner.
    setTimeout(() => {
      router.push(`/learn/${props.programId}`);
      router.refresh();
    }, 800);
  }

  const tokenPct = Math.min(100, Math.round((tokensUsed / Math.max(1, props.bot?.tokenBudget ?? 1)) * 100));

  return (
    <div className="cq-chat">
      <aside className="cq-chat__rail">
        <Eyebrow>{props.programTitle.toUpperCase()}</Eyebrow>
        <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, marginBottom: 16 }}>
          NODE {bin(props.pathNodes.findIndex((n) => n.id === props.nodeId) + 1, 8)}
        </div>
        {props.pathNodes.map((n) => {
          const isLocked = n.status === "LOCKED";
          const isActive = n.id === props.nodeId;
          const sharedStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            border: "var(--hair) solid var(--ink)",
            background: isActive ? "var(--ink)" : "var(--paper)",
            color: isActive ? "var(--paper)" : "var(--ink)",
            opacity: isLocked ? 0.55 : 1,
            marginBottom: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            cursor: isLocked ? "not-allowed" : undefined,
          };
          const inner = (
            <>
              <span style={{ fontFamily: "var(--font-pixel)", fontSize: 8, flexShrink: 0 }}>
                {bin(n.index, 4)}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {n.title}
              </span>
              {n.status === "DONE" && <Icon name="check" size={12} />}
              {n.status === "ACTIVE" && <Icon name="play" size={10} />}
              {n.status === "LOCKED" && <Icon name="lock" size={10} />}
            </>
          );
          if (isLocked) {
            // Render a non-link span so accidental clicks don't navigate
            // into the access-denied error path.
            return (
              <span
                key={n.id}
                aria-disabled
                title="Locked — complete prereqs first."
                style={sharedStyle}
              >
                {inner}
              </span>
            );
          }
          return (
            <Link key={n.id} href={`/learn/${props.programId}/${n.id}`} style={sharedStyle}>
              {inner}
            </Link>
          );
        })}
      </aside>

      <div className="cq-chat__main">
        <div className="cq-chat__head">
          <div className="l">
            <div className="cq-chat__avatar">{props.bot?.avatar ?? "AI"}</div>
            <div>
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                {bin(1, 8)} · CHATBOT NODE
              </div>
              <div className="cq-title-m">{(props.bot?.name ?? "AI Tutor").toUpperCase()}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <div className="cq-chat__progress" style={{ gap: 6 }}>
              <span>ATTEMPT</span>
              <Chip ghost>
                {props.attempt}/{props.bot?.attemptsAllowed ?? 2}
              </Chip>
            </div>
            <div className="cq-chat__progress" style={{ gap: 6 }}>
              <span>TOKENS {(tokensUsed / 1000).toFixed(1)}K</span>
              <div className="cq-progressbar" style={{ width: 80 }}>
                <i style={{ width: `${tokenPct}%` }} />
              </div>
            </div>
            <Btn sm ghost asChild title="Download this transcript as Markdown">
              <a
                href={`/api/conversations/${props.conversationId}/export`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="download" />
              </a>
            </Btn>
            <Btn sm onClick={onSubmit} disabled={pending || submitted}>
              {submitted ? "SUBMITTED" : "SUBMIT"} <Icon name="arrow" />
            </Btn>
          </div>
        </div>

        {props.bot?.instructions ? (
          <div
            style={{
              padding: "14px 24px",
              borderBottom: "var(--hair) solid var(--ink)",
              background: "var(--soft)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            <Chip>BRIEFING</Chip>
            <span>{props.bot.instructions}</span>
          </div>
        ) : null}

        {budgetExhausted ? (
          <div
            style={{
              padding: "14px 24px",
              borderBottom: "var(--hair) solid var(--ink)",
              background: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              ■ {budgetExhausted === "attempt" ? "ATTEMPT TOKEN BUDGET EXHAUSTED" : "MONTHLY TOKEN BUDGET EXHAUSTED"}
            </div>
            <div style={{ opacity: 0.85 }}>
              {budgetExhausted === "attempt"
                ? "You've used the token budget for this attempt. Submit what you have for grading — your instructor can grant a retry if needed."
                : "Your organization's monthly token budget is fully spent. Submit what you have; new messages will be blocked until the cycle resets or the plan is upgraded."}
            </div>
          </div>
        ) : null}

        <div className="cq-chat__stream" ref={streamRef}>
          {messages.length === 0 ? (
            <div className="cq-mono" style={{ color: "var(--muted)", textAlign: "center" }}>
              SEND YOUR FIRST MESSAGE TO BEGIN.
            </div>
          ) : null}
          {messages.map((m, i) => (
            <div key={m.id ?? i} className={cx("cq-msg", m.role === "assistant" ? "cq-msg--bot" : "cq-msg--me")}>
              <div className="cq-msg__head">
                <span>
                  ■ {m.role === "assistant" ? (props.bot?.name ?? "AI").toUpperCase() : props.learnerName.toUpperCase()}
                </span>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {m.content}
                {m.streaming ? <span style={{ opacity: 0.5 }}>▍</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="cq-chat__composer">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              budgetExhausted
                ? "Token budget exhausted — submit above to finish this attempt."
                : "Type your response. Shift+Enter for newline."
            }
            disabled={pending || submitted || !!budgetExhausted}
          />
          <Btn onClick={send} disabled={pending || submitted || !draft.trim() || !!budgetExhausted}>
            SEND <Icon name="send" />
          </Btn>
        </div>
      </div>
    </div>
  );
}
