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
import { updateNode, deleteNode } from "@/lib/path/actions";
import { RichTextEditor } from "@/components/brutalist/rich-text";

// ───────── shared types ─────────

export interface NodeData {
  id: string;
  type: "bot" | "content" | "pdf" | "slides" | "link" | "milestone" | "cert";
  title: string;
  display_order: number;
  points: number | null;
  is_required: boolean;
  config: Record<string, unknown>;
}

export interface SiblingNode {
  id: string;
  title: string;
  type: string;
  display_order: number;
}

export interface InspectorProps {
  programId: string;
  node: NodeData;
  siblings: SiblingNode[];
  onChange: () => void;
  onDelete: () => void;
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
        {node.type === "bot" ? (
          <Btn sm ghost asChild>
            <a href={`/programs/${programId}/nodes/${node.id}`}>BOT EDITOR <Icon name="arrow" /></a>
          </Btn>
        ) : null}
      </div>
      <div style={{ marginTop: 16 }}>
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
}: {
  title: string;
  setTitle: (s: string) => void;
  points: string;
  setPoints: (s: string) => void;
  isRequired: boolean;
  setIsRequired: (b: boolean) => void;
  hidePoints?: boolean;
}) {
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
    </>
  );
}

// ───────── BOT (existing flow — link out to the dedicated editor) ─────────

export function BotInspector(props: InspectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(props.node.title);
  const [points, setPoints] = React.useState(String(props.node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(props.node.is_required);

  async function save() {
    setPending(true);
    const res = await updateNode({
      nodeId: props.node.id,
      programId: props.programId,
      title,
      points: Number(points),
      isRequired,
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
      />
      <div
        className="cq-mono"
        style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}
      >
        Edit the bot&apos;s system prompt, model, attempts, and rubric in the
        dedicated bot editor.
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
        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} minHeight={260} />
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
  const [requiredIds, setRequiredIds] = React.useState<string[]>([]);
  const [minGrade, setMinGrade] = React.useState("80");
  const [requiresApproval, setRequiresApproval] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // Load the certificate row that backs this node.
  React.useEffect(() => {
    if (loaded) return;
    (async () => {
      const cfg = (props.node.config as { certificate_id?: string }) ?? {};
      if (!cfg.certificate_id) {
        setLoaded(true);
        return;
      }
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("certificates")
          .select("required_node_ids, min_grade_percentage, requires_instructor_approval")
          .eq("id", cfg.certificate_id)
          .maybeSingle();
        if (data) {
          setRequiredIds((data.required_node_ids as string[] | null) ?? []);
          setMinGrade(String(data.min_grade_percentage ?? 80));
          setRequiresApproval(!!data.requires_instructor_approval);
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
      />
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
