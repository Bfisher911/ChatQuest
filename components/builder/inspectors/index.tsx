"use client";

import * as React from "react";
import { Btn, Chip, Icon } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { cx } from "@/lib/utils/cx";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  uploadNodeFile,
  deleteNodeFile,
  upsertCertForNode,
} from "@/lib/path/file-actions";
import { updateNode, deleteNode, updateBotConfig, duplicateNode } from "@/lib/path/actions";
import { RichTextEditor } from "@/components/brutalist/rich-text";
import Link from "next/link";

// ───────── shared types ─────────

export interface NodeData {
  id: string;
  type: "bot" | "content" | "pdf" | "slides" | "link" | "milestone" | "cert";
  title: string;
  display_order: number;
  points: number | null;
  is_required: boolean;
  config: Record<string, unknown>;
  /** ISO timestamp — when this node first becomes available to learners. */
  available_at?: string | null;
  /** ISO timestamp — past this point the engine treats unattempted as failed. */
  due_at?: string | null;
}

export interface SiblingNode {
  id: string;
  title: string;
  type: string;
  display_order: number;
}

export interface RubricChoice {
  id: string;
  name: string;
  total_points: number | null;
}

export interface BotConfigData {
  node_id: string;
  system_prompt: string | null;
  learner_instructions: string | null;
  model: string | null;
  temperature: string | number | null;
  token_budget: number | null;
  max_tokens: number | null;
  attempts_allowed: number | null;
  rubric_id: string | null;
  conversation_goal: string | null;
  completion_criteria: string | null;
  ai_grading_enabled: boolean | null;
  allow_retry_after_feedback: boolean | null;
}

export interface InspectorProps {
  programId: string;
  node: NodeData;
  siblings: SiblingNode[];
  onChange: () => void;
  onDelete: () => void;
  /** Org rubrics — only required for the BotInspector. */
  rubrics?: RubricChoice[];
  /** Existing bot config row — only required for the BotInspector. */
  botConfig?: BotConfigData | null;
}

// ───────── shared shell ─────────

function InspectorShell({
  programId,
  node,
  onDelete,
  children,
  onSave,
  pending,
}: {
  programId: string;
  node: NodeData;
  onDelete: () => void;
  onSave?: () => void;
  pending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4>■ INSPECTOR · {bin(node.display_order + 1, 4)}</h4>
      <div className="cq-field">
        <label>Type</label>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip>{node.type.toUpperCase()}</Chip>
        </div>
      </div>

      {children}

      <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {onSave ? (
          <Btn sm onClick={onSave} disabled={pending}>
            {pending ? "SAVING…" : "SAVE"} <Icon name="check" />
          </Btn>
        ) : null}
        {/* Bot inspector is now fully inline — the standalone bot editor
            stays as a deep link for power users who want a wider canvas. */}
      </div>
      <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
        <DuplicateNodeButton nodeId={node.id} />
        <Btn sm ghost onClick={onDelete}>
          <Icon name="trash" /> DELETE NODE
        </Btn>
      </div>
    </div>
  );
}

// ───────── shared title + points + required ─────────

function CommonNodeFields({
  title,
  setTitle,
  points,
  setPoints,
  isRequired,
  setIsRequired,
  hidePoints,
  availableAt,
  setAvailableAt,
  dueAt,
  setDueAt,
}: {
  title: string;
  setTitle: (s: string) => void;
  points: string;
  setPoints: (s: string) => void;
  isRequired: boolean;
  setIsRequired: (b: boolean) => void;
  hidePoints?: boolean;
  /** ISO datetime-local string ("2026-05-15T14:00") or empty. */
  availableAt?: string;
  setAvailableAt?: (s: string) => void;
  dueAt?: string;
  setDueAt?: (s: string) => void;
}) {
  const showSchedule = !!setAvailableAt && !!setDueAt;
  return (
    <>
      <div className="cq-field">
        <label htmlFor="title">Title</label>
        <input id="title" className="cq-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        {!hidePoints ? (
          <div className="cq-field">
            <label htmlFor="points">Points</label>
            <input
              id="points"
              type="number"
              min={0}
              className="cq-input"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
        ) : null}
        <div className="cq-field">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            <span>Required</span>
          </label>
        </div>
      </div>
      {showSchedule ? (
        <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
          <div className="cq-field">
            <label htmlFor="available-at">Available at</label>
            <input
              id="available-at"
              type="datetime-local"
              className="cq-input"
              value={availableAt ?? ""}
              onChange={(e) => setAvailableAt!(e.target.value)}
            />
          </div>
          <div className="cq-field">
            <label htmlFor="due-at">Due at</label>
            <input
              id="due-at"
              type="datetime-local"
              className="cq-input"
              value={dueAt ?? ""}
              onChange={(e) => setDueAt!(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Convert an ISO timestamp from the DB to the format expected by
 * <input type="datetime-local"> (YYYY-MM-DDTHH:mm, no timezone).
 */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  // Trim seconds + timezone — datetime-local doesn't accept them.
  return iso.slice(0, 16);
}

/**
 * Convert a datetime-local input value to a full ISO string the DB
 * accepts. Returns null when the input is empty so the action clears
 * the column.
 */
function localInputToIso(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ───────── BOT (existing flow — link out to the dedicated editor) ─────────

export function BotInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 25));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));

  const cfg = props.botConfig;
  const rubrics = props.rubrics ?? [];

  const [systemPrompt, setSystemPrompt] = React.useState(
    cfg?.system_prompt ?? "You are a helpful tutor. Probe assumptions; demand citations from the program knowledge base.",
  );
  const [learnerInstructions, setLearnerInstructions] = React.useState(cfg?.learner_instructions ?? "");
  const [model, setModel] = React.useState(cfg?.model ?? "claude-haiku-4-5");
  const [temperature, setTemperature] = React.useState(String(cfg?.temperature ?? 0.4));
  const [tokenBudget, setTokenBudget] = React.useState(String(cfg?.token_budget ?? 8000));
  const [maxTokens, setMaxTokens] = React.useState(String(cfg?.max_tokens ?? 1024));
  const [attempts, setAttempts] = React.useState(String(cfg?.attempts_allowed ?? 2));
  const [rubricId, setRubricId] = React.useState(cfg?.rubric_id ?? "");
  const [conversationGoal, setConversationGoal] = React.useState(cfg?.conversation_goal ?? "");
  const [completionCriteria, setCompletionCriteria] = React.useState(cfg?.completion_criteria ?? "");
  const [aiGradingEnabled, setAiGradingEnabled] = React.useState(cfg?.ai_grading_enabled ?? true);
  const [allowRetry, setAllowRetry] = React.useState(cfg?.allow_retry_after_feedback ?? true);

  // Re-sync state when the inspector switches to a different bot node.
  React.useEffect(() => {
    setTitle(props.node.title);
    setPoints(String(props.node.points ?? 25));
    setIsRequired(props.node.is_required);
    setAvailableAt(isoToLocalInput(props.node.available_at));
    setDueAt(isoToLocalInput(props.node.due_at));
    setSystemPrompt(cfg?.system_prompt ?? "You are a helpful tutor. Probe assumptions; demand citations from the program knowledge base.");
    setLearnerInstructions(cfg?.learner_instructions ?? "");
    setModel(cfg?.model ?? "claude-haiku-4-5");
    setTemperature(String(cfg?.temperature ?? 0.4));
    setTokenBudget(String(cfg?.token_budget ?? 8000));
    setMaxTokens(String(cfg?.max_tokens ?? 1024));
    setAttempts(String(cfg?.attempts_allowed ?? 2));
    setRubricId(cfg?.rubric_id ?? "");
    setConversationGoal(cfg?.conversation_goal ?? "");
    setCompletionCriteria(cfg?.completion_criteria ?? "");
    setAiGradingEnabled(cfg?.ai_grading_enabled ?? true);
    setAllowRetry(cfg?.allow_retry_after_feedback ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.node.id]);

  async function save() {
    setPending(true);
    // Save the node-level bits (title / points / required) AND the bot
    // config row in parallel.
    const [nodeRes, cfgRes] = await Promise.all([
      updateNode({
        nodeId: props.node.id,
        programId: props.programId,
        title,
        points: Number(points),
        isRequired,
        availableAt: localInputToIso(availableAt),
        dueAt: localInputToIso(dueAt),
      }),
      updateBotConfig({
        nodeId: props.node.id,
        programId: props.programId,
        systemPrompt,
        learnerInstructions: learnerInstructions || null,
        model,
        temperature: Number(temperature),
        tokenBudget: Number(tokenBudget),
        maxTokens: Number(maxTokens),
        attemptsAllowed: Number(attempts),
        rubricId: rubricId || null,
        conversationGoal: conversationGoal || null,
        completionCriteria: completionCriteria || null,
        aiGradingEnabled,
        allowRetryAfterFeedback: allowRetry,
      }),
    ]);
    setPending(false);
    if (!nodeRes.ok) {
      toast.error(nodeRes.error);
      return;
    }
    if (!cfgRes.ok) {
      toast.error(cfgRes.error);
      return;
    }
    toast.success("Bot saved.");
    props.onChange();
    router.refresh();
  }

  return (
    <InspectorShell
      programId={props.programId}
      node={props.node}
      onDelete={props.onDelete}
      onSave={save}
      pending={pending}
    >
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />

      <div className="cq-field" style={{ marginTop: 12 }}>
        <label>Learner-facing instructions</label>
        <textarea
          className="cq-textarea"
          value={learnerInstructions}
          onChange={(e) => setLearnerInstructions(e.target.value)}
          placeholder="What the learner should accomplish."
          rows={3}
        />
      </div>

      <div className="cq-field">
        <label>System prompt</label>
        <textarea
          className="cq-textarea"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
        />
      </div>

      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label>Model</label>
          <select
            className="cq-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
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
          <label>Temp</label>
          <input
            type="number"
            step="0.05"
            min={0}
            max={1}
            className="cq-input"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>
        <div className="cq-field">
          <label>Token budget</label>
          <input
            type="number"
            min={500}
            className="cq-input"
            value={tokenBudget}
            onChange={(e) => setTokenBudget(e.target.value)}
          />
        </div>
        <div className="cq-field">
          <label>Max tokens / reply</label>
          <input
            type="number"
            min={64}
            className="cq-input"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
          />
        </div>
        <div className="cq-field">
          <label>Attempts</label>
          <input
            type="number"
            min={1}
            className="cq-input"
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
          />
        </div>
      </div>

      <div className="cq-field">
        <label>Rubric (for AI grading)</label>
        <select
          className="cq-select"
          value={rubricId}
          onChange={(e) => setRubricId(e.target.value)}
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
              No rubrics yet.{" "}
              <Link href="/rubrics/new" style={{ textDecoration: "underline" }}>
                Create one
              </Link>{" "}
              for AI-suggested scores.
            </>
          ) : (
            <>
              Manage at{" "}
              <Link href="/rubrics" style={{ textDecoration: "underline" }}>
                /rubrics
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="cq-field">
        <label>Conversation goal (optional)</label>
        <input
          className="cq-input"
          value={conversationGoal}
          onChange={(e) => setConversationGoal(e.target.value)}
          placeholder="What the learner should walk away knowing."
        />
      </div>

      <div className="cq-field">
        <label>Completion criteria (optional)</label>
        <input
          className="cq-input"
          value={completionCriteria}
          onChange={(e) => setCompletionCriteria(e.target.value)}
          placeholder="What 'done' looks like in this conversation."
        />
      </div>

      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={aiGradingEnabled} onChange={(e) => setAiGradingEnabled(e.target.checked)} />
          <span>AI grading suggestion (instructor still has the final say)</span>
        </label>
      </div>

      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={allowRetry} onChange={(e) => setAllowRetry(e.target.checked)} />
          <span>Allow retry after &quot;needs revision&quot;</span>
        </label>
      </div>

      <div style={{ marginTop: 4 }}>
        <Link
          href={`/programs/${props.programId}/nodes/${props.node.id}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            textDecoration: "underline",
          }}
        >
          Open in standalone bot editor →
        </Link>
      </div>
    </InspectorShell>
  );
}

// ───────── CONTENT ─────────

export function ContentInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));
  const cfg = (props.node.config as { body_html?: string; reading_minutes?: number; require_completion_check?: boolean }) ?? {};
  const [bodyHtml, setBodyHtml] = React.useState(cfg.body_html ?? "<p></p>");
  const [readingMinutes, setReadingMinutes] = React.useState(String(cfg.reading_minutes ?? 5));
  const [requireCompletion, setRequireCompletion] = React.useState(cfg.require_completion_check ?? true);

  async function save() {
    setPending(true);
    const res = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
      availableAt: localInputToIso(availableAt),
      dueAt: localInputToIso(dueAt),
      config: {
        body_html: bodyHtml,
        reading_minutes: Number(readingMinutes) || 0,
        require_completion_check: requireCompletion,
      },
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Saved.");
      props.onChange();
      router.refresh();
    }
  }

  return (
    <InspectorShell programId={props.programId} node={props.node} onDelete={props.onDelete} onSave={save} pending={pending}>
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />
      <div className="cq-field">
        <label>Reading time (minutes)</label>
        <input
          type="number"
          min={0}
          className="cq-input"
          value={readingMinutes}
          onChange={(e) => setReadingMinutes(e.target.value)}
        />
      </div>
      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={requireCompletion}
            onChange={(e) => setRequireCompletion(e.target.checked)}
          />
          <span>Require learner to click &quot;mark complete&quot;</span>
        </label>
      </div>
      <div className="cq-field">
        <label>Body</label>
        <RichTextEditor
          value={bodyHtml}
          onChange={setBodyHtml}
          minHeight={260}
          imageUploadContext={{ programId: props.programId, nodeId: props.node.id }}
        />
      </div>
    </InspectorShell>
  );
}

// ───────── PDF ─────────

export function PdfInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));
  const cfg = (props.node.config as { storage_path?: string; filename?: string; require_acknowledgement?: boolean; bytes?: number }) ?? {};
  const [storagePath, setStoragePath] = React.useState(cfg.storage_path ?? "");
  const [filename, setFilename] = React.useState(cfg.filename ?? "");
  const [bytes, setBytes] = React.useState<number | null>(cfg.bytes ?? null);
  const [requireAck, setRequireAck] = React.useState(cfg.require_acknowledgement ?? true);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setPending(true);
    const fd = new FormData();
    fd.set("programId", props.programId);
    fd.set("nodeId", props.node.id);
    fd.set("file", file);
    const res = await uploadNodeFile(fd);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStoragePath(res.storagePath);
    setFilename(res.filename);
    setBytes(res.bytes);
    setSignedUrl(res.signedUrl);
    toast.success("Uploaded.");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function onRemove() {
    if (!confirm("Remove this PDF?")) return;
    setPending(true);
    await deleteNodeFile(props.programId, props.node.id);
    setPending(false);
    setStoragePath("");
    setFilename("");
    setBytes(null);
    setSignedUrl(null);
    router.refresh();
  }

  async function saveMeta() {
    setPending(true);
    const res = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
      availableAt: localInputToIso(availableAt),
      dueAt: localInputToIso(dueAt),
      config: {
        storage_path: storagePath || undefined,
        filename: filename || undefined,
        bytes: bytes ?? undefined,
        require_acknowledgement: requireAck,
      },
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Saved.");
      props.onChange();
      router.refresh();
    }
  }

  return (
    <InspectorShell programId={props.programId} node={props.node} onDelete={props.onDelete} onSave={saveMeta} pending={pending}>
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />
      <div className="cq-field">
        <label>PDF</label>
        {storagePath ? (
          <div style={{ border: "var(--hair) solid var(--ink)", padding: 12 }}>
            <div className="cq-mono" style={{ fontSize: 13, fontWeight: 700 }}>{filename || "document.pdf"}</div>
            {bytes ? (
              <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                {(bytes / 1024 / 1024).toFixed(2)} MB
              </div>
            ) : null}
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              {signedUrl ? (
                <Btn sm ghost asChild>
                  <a href={signedUrl} target="_blank" rel="noreferrer">
                    <Icon name="file" /> PREVIEW
                  </a>
                </Btn>
              ) : null}
              <Btn sm ghost onClick={onRemove} disabled={pending}>
                <Icon name="trash" /> REMOVE
              </Btn>
            </div>
          </div>
        ) : (
          <form onSubmit={onUpload}>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="cq-input" disabled={pending} />
            <div style={{ marginTop: 8 }}>
              <Btn sm type="submit" disabled={pending}>
                {pending ? "UPLOADING…" : "UPLOAD PDF"} <Icon name="upload" />
              </Btn>
            </div>
          </form>
        )}
      </div>
      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={requireAck}
            onChange={(e) => setRequireAck(e.target.checked)}
          />
          <span>Require learner acknowledgement</span>
        </label>
      </div>
    </InspectorShell>
  );
}

// ───────── LINK ─────────

export function LinkInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));
  const cfg = (props.node.config as { url?: string; description?: string; open_in_new_tab?: boolean; require_confirmation?: boolean }) ?? {};
  const [url, setUrl] = React.useState(cfg.url ?? "https://");
  const [description, setDescription] = React.useState(cfg.description ?? "");
  const [openInNewTab, setOpenInNewTab] = React.useState(cfg.open_in_new_tab ?? true);
  const [requireConfirmation, setRequireConfirmation] = React.useState(cfg.require_confirmation ?? false);

  async function save() {
    if (!/^https?:\/\//i.test(url)) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setPending(true);
    const res = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
      availableAt: localInputToIso(availableAt),
      dueAt: localInputToIso(dueAt),
      config: {
        url,
        description,
        open_in_new_tab: openInNewTab,
        require_confirmation: requireConfirmation,
      },
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Saved.");
      props.onChange();
      router.refresh();
    }
  }

  return (
    <InspectorShell programId={props.programId} node={props.node} onDelete={props.onDelete} onSave={save} pending={pending}>
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />
      <div className="cq-field">
        <label htmlFor="url">URL</label>
        <input id="url" className="cq-input" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="cq-field">
        <label htmlFor="link-desc">Description (shown to learner)</label>
        <textarea
          id="link-desc"
          className="cq-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={openInNewTab}
            onChange={(e) => setOpenInNewTab(e.target.checked)}
          />
          <span>Open in new tab</span>
        </label>
      </div>
      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={requireConfirmation}
            onChange={(e) => setRequireConfirmation(e.target.checked)}
          />
          <span>Require &quot;I visited this&quot; confirmation</span>
        </label>
      </div>
    </InspectorShell>
  );
}

// ───────── SLIDES ─────────

interface Slide {
  title: string;
  body: string;
  image_url?: string;
}

export function SlidesInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));
  const cfg = (props.node.config as { slides?: Slide[] }) ?? {};
  const [slides, setSlides] = React.useState<Slide[]>(cfg.slides ?? [{ title: "Slide 1", body: "" }]);

  function patch(idx: number, patch: Partial<Slide>) {
    setSlides((s) => s.map((sl, i) => (i === idx ? { ...sl, ...patch } : sl)));
  }
  function addSlide() {
    setSlides((s) => [...s, { title: `Slide ${s.length + 1}`, body: "" }]);
  }
  function removeSlide(idx: number) {
    setSlides((s) => s.filter((_, i) => i !== idx));
  }
  function move(idx: number, delta: number) {
    setSlides((s) => {
      const next = [...s];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function save() {
    setPending(true);
    const res = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
      availableAt: localInputToIso(availableAt),
      dueAt: localInputToIso(dueAt),
      config: { slides },
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Saved.");
      props.onChange();
      router.refresh();
    }
  }

  return (
    <InspectorShell programId={props.programId} node={props.node} onDelete={props.onDelete} onSave={save} pending={pending}>
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />
      <div className="cq-field">
        <label>Slides ({slides.length})</label>
      </div>
      {slides.map((slide, i) => (
        <div
          key={i}
          style={{
            border: "var(--hair) solid var(--ink)",
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="cq-mono" style={{ fontSize: 12 }}>SLIDE {i + 1}</span>
            <div className="row" style={{ gap: 4 }}>
              <button
                type="button"
                className="cq-icon-btn"
                style={{ width: 28, height: 28 }}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="cq-icon-btn"
                style={{ width: 28, height: 28 }}
                disabled={i === slides.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="cq-icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={() => removeSlide(i)}
                disabled={slides.length <= 1}
                aria-label="Remove slide"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          </div>
          <input
            className="cq-input"
            value={slide.title}
            onChange={(e) => patch(i, { title: e.target.value })}
            placeholder="Slide title"
            style={{ marginBottom: 6 }}
          />
          <textarea
            className="cq-textarea"
            value={slide.body}
            onChange={(e) => patch(i, { body: e.target.value })}
            placeholder="Slide body"
            rows={3}
          />
          <input
            className="cq-input"
            value={slide.image_url ?? ""}
            onChange={(e) => patch(i, { image_url: e.target.value })}
            placeholder="Image URL (optional)"
            style={{ marginTop: 6 }}
          />
        </div>
      ))}
      <Btn sm ghost onClick={addSlide}>
        <Icon name="plus" /> ADD SLIDE
      </Btn>
    </InspectorShell>
  );
}

// ───────── MILESTONE ─────────

export function MilestoneInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));
  const cfg = (props.node.config as { required_node_ids?: string[]; min_grade_percentage?: number; awards_certificate_id?: string | null }) ?? {};
  const [requiredIds, setRequiredIds] = React.useState<string[]>(cfg.required_node_ids ?? []);
  const [minGrade, setMinGrade] = React.useState(String(cfg.min_grade_percentage ?? 70));

  function toggle(id: string) {
    setRequiredIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save() {
    setPending(true);
    const res = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
      availableAt: localInputToIso(availableAt),
      dueAt: localInputToIso(dueAt),
      config: {
        required_node_ids: requiredIds,
        min_grade_percentage: Number(minGrade) || 0,
      },
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Saved.");
      props.onChange();
      router.refresh();
    }
  }

  const eligibleSiblings = props.siblings.filter((s) => s.id !== props.node.id && s.type !== "milestone");

  return (
    <InspectorShell programId={props.programId} node={props.node} onDelete={props.onDelete} onSave={save} pending={pending}>
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        hidePoints
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />
      <div className="cq-field">
        <label htmlFor="min-grade">Minimum grade percentage on required nodes</label>
        <input
          id="min-grade"
          type="number"
          min={0}
          max={100}
          step={1}
          className="cq-input"
          value={minGrade}
          onChange={(e) => setMinGrade(e.target.value)}
        />
      </div>
      <div className="cq-field">
        <label>Required nodes (must all complete + meet min grade)</label>
        <div style={{ border: "var(--hair) solid var(--ink)", maxHeight: 220, overflowY: "auto" }}>
          {eligibleSiblings.length === 0 ? (
            <div className="cq-mono" style={{ fontSize: 12, padding: 12, color: "var(--muted)" }}>
              No other nodes in this Chatrail yet.
            </div>
          ) : (
            eligibleSiblings.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderBottom: "var(--hair) solid var(--ink)",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={requiredIds.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span style={{ flex: 1 }}>{s.title}</span>
                <Chip ghost>{s.type.toUpperCase()}</Chip>
              </label>
            ))
          )}
        </div>
      </div>
    </InspectorShell>
  );
}

// ───────── CERT ─────────

export function CertInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);
  const [availableAt, setAvailableAt] = React.useState(isoToLocalInput(props.node.available_at));
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(props.node.due_at));
  const [requiredIds, setRequiredIds] = React.useState<string[]>([]);
  const [minGrade, setMinGrade] = React.useState("80");
  const [requiresApproval, setRequiresApproval] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<{ id: string; name: string; slug: string }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  // Load the certificate row that backs this node + the org's template list.
  React.useEffect(() => {
    if (loaded) return;
    (async () => {
      const cfg = (props.node.config as { certificate_id?: string }) ?? {};
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        // All templates the caller can read (RLS scopes to their org).
        const { data: tpls } = await supabase
          .from("certificate_templates")
          .select("id, name, slug")
          .order("created_at", { ascending: true });
        setTemplates((tpls ?? []) as { id: string; name: string; slug: string }[]);

        if (cfg.certificate_id) {
          const { data } = await supabase
            .from("certificates")
            .select("required_node_ids, min_grade_percentage, requires_instructor_approval, template_id")
            .eq("id", cfg.certificate_id)
            .maybeSingle();
          if (data) {
            setRequiredIds((data.required_node_ids as string[] | null) ?? []);
            setMinGrade(String(data.min_grade_percentage ?? 80));
            setRequiresApproval(!!data.requires_instructor_approval);
            setTemplateId(data.template_id ?? null);
          }
        }
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.node.id]);

  function toggle(id: string) {
    setRequiredIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save() {
    setPending(true);
    // First sync the path_node title/points/required.
    const r1 = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
      availableAt: localInputToIso(availableAt),
      dueAt: localInputToIso(dueAt),
    });
    if (!r1.ok) {
      setPending(false);
      toast.error(r1.error);
      return;
    }
    // Then upsert the certificates row.
    const r2 = await upsertCertForNode({
      programId: props.programId,
      nodeId: props.node.id,
      title,
      requiredNodeIds: requiredIds,
      minGradePercentage: Number(minGrade) || 0,
      requiresInstructorApproval: requiresApproval,
      templateId: templateId ?? undefined,
    });
    setPending(false);
    if (!r2.ok) {
      toast.error(r2.error);
      return;
    }
    toast.success("Certificate saved.");
    props.onChange();
    router.refresh();
  }

  const eligibleSiblings = props.siblings.filter((s) => s.id !== props.node.id && s.type !== "cert");

  return (
    <InspectorShell programId={props.programId} node={props.node} onDelete={props.onDelete} onSave={save} pending={pending}>
      <CommonNodeFields
        title={title}
        setTitle={setTitle}
        points={points}
        setPoints={setPoints}
        isRequired={isRequired}
        setIsRequired={setIsRequired}
        hidePoints
        availableAt={availableAt}
        setAvailableAt={setAvailableAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
      />
      <div className="cq-field">
        <label>Certificate template</label>
        {templates.length === 0 ? (
          <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            Loading templates…
          </div>
        ) : (
          <>
            <select
              className="cq-input"
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value || null)}
            >
              <option value="">Default (first template in org)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.slug}
                </option>
              ))}
            </select>
            <div
              className="cq-mono"
              style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}
            >
              <a href="/org/cert-template" style={{ color: "inherit", textDecoration: "underline" }}>
                Edit templates
              </a>
              {" · "}
              controls signer name, body text, and org logo.
            </div>
          </>
        )}
      </div>
      <div className="cq-field">
        <label>Minimum grade percentage on required nodes</label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          className="cq-input"
          value={minGrade}
          onChange={(e) => setMinGrade(e.target.value)}
        />
      </div>
      <div className="cq-field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
          />
          <span>Require instructor approval before issuing</span>
        </label>
      </div>
      <div className="cq-field">
        <label>Required nodes for this certificate</label>
        <div style={{ border: "var(--hair) solid var(--ink)", maxHeight: 220, overflowY: "auto" }}>
          {eligibleSiblings.length === 0 ? (
            <div className="cq-mono" style={{ fontSize: 12, padding: 12, color: "var(--muted)" }}>
              No other nodes yet.
            </div>
          ) : (
            eligibleSiblings.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderBottom: "var(--hair) solid var(--ink)",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={requiredIds.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span style={{ flex: 1 }}>{s.title}</span>
                <Chip ghost>{s.type.toUpperCase()}</Chip>
              </label>
            ))
          )}
        </div>
      </div>
      <div
        className="cq-mono"
        style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}
      >
        When a learner completes every required node at ≥ {minGrade || 0}%, a
        certificate is auto-issued (or queued for your review if instructor
        approval is required).
      </div>
    </InspectorShell>
  );
}

// ───────── shared DUPLICATE button ─────────

function DuplicateNodeButton({ nodeId }: { nodeId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Btn
      sm
      ghost
      disabled={pending}
      onClick={async () => {
        if (
          !confirm(
            "Duplicate this node? The copy lands offset on the canvas with a 'Copy of' title and no incoming/outgoing edges.",
          )
        )
          return;
        setPending(true);
        const res = await duplicateNode(nodeId);
        setPending(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Node duplicated.");
        router.refresh();
      }}
    >
      {pending ? "…" : "DUPLICATE NODE"} <Icon name="grid" />
    </Btn>
  );
}

// ───────── DISPATCHER ─────────

export function NodeInspector(props: InspectorProps) {
  switch (props.node.type) {
    case "bot":
      return <BotInspector {...props} />;
    case "content":
      return <ContentInspector {...props} />;
    case "pdf":
      return <PdfInspector {...props} />;
    case "slides":
      return <SlidesInspector {...props} />;
    case "link":
      return <LinkInspector {...props} />;
    case "milestone":
      return <MilestoneInspector {...props} />;
    case "cert":
      return <CertInspector {...props} />;
    default:
      return <BotInspector {...props} />;
  }
}

// Helper used by the path-builder for type-safe wiring with the existing
// deleteNode action.
export async function deleteNodeViaInspector(nodeId: string, programId: string) {
  return deleteNode(nodeId, programId);
}
