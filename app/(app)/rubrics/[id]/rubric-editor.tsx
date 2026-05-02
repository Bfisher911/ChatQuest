"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn, Chip, Eyebrow, Icon, IconBtn, Frame } from "@/components/brutalist";
import { toast } from "sonner";
import {
  updateRubric,
  upsertCriterion,
  deleteCriterion,
  deleteRubric,
  reorderCriteria,
} from "../actions";

interface Criterion {
  id: string;
  name: string;
  description: string;
  max_points: number;
  display_order: number;
}

interface RubricEditorProps {
  rubric: { id: string; name: string; description: string; isVisibleToLearners: boolean };
  initialCriteria: Criterion[];
  attachedTo: { nodeId: string; nodeTitle: string; programId: string; programTitle: string }[];
}

export function RubricEditor({ rubric, initialCriteria, attachedTo }: RubricEditorProps) {
  const router = useRouter();
  const [name, setName] = React.useState(rubric.name);
  const [description, setDescription] = React.useState(rubric.description);
  const [isVisible, setIsVisible] = React.useState(rubric.isVisibleToLearners);
  const [criteria, setCriteria] = React.useState<Criterion[]>(initialCriteria);
  const [pending, setPending] = React.useState(false);

  // ─── rubric metadata save ───
  async function saveRubric() {
    setPending(true);
    const res = await updateRubric({
      rubricId: rubric.id,
      name,
      description,
      isVisibleToLearners: isVisible,
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Rubric saved.");
      router.refresh();
    }
  }

  async function removeRubric() {
    if (attachedTo.length > 0) {
      toast.error(`Detach this rubric from ${attachedTo.length} chatbot node(s) first.`);
      return;
    }
    if (!confirm("Delete this rubric? This can't be undone.")) return;
    setPending(true);
    const res = await deleteRubric(rubric.id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deleted.");
    router.push("/rubrics");
  }

  // ─── criterion ops ───
  function patchLocal(idx: number, patch: Partial<Criterion>) {
    setCriteria((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function saveCriterion(idx: number) {
    const c = criteria[idx];
    if (!c) return;
    setPending(true);
    const res = await upsertCriterion({
      rubricId: rubric.id,
      criterionId: c.id,
      name: c.name,
      description: c.description,
      maxPoints: c.max_points,
      displayOrder: c.display_order,
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Criterion saved.");
      router.refresh();
    }
  }

  async function addCriterion() {
    setPending(true);
    const res = await upsertCriterion({
      rubricId: rubric.id,
      name: `Criterion ${criteria.length + 1}`,
      description: "",
      maxPoints: 5,
      displayOrder: criteria.length,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Criterion added.");
    router.refresh();
  }

  async function removeCriterion(idx: number) {
    const c = criteria[idx];
    if (!c) return;
    if (criteria.length <= 1) {
      toast.error("A rubric needs at least one criterion.");
      return;
    }
    if (!confirm(`Delete "${c.name}"?`)) return;
    setPending(true);
    const res = await deleteCriterion(rubric.id, c.id);
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Removed.");
      router.refresh();
    }
  }

  async function move(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= criteria.length) return;
    const next = [...criteria];
    [next[idx], next[target]] = [next[target], next[idx]];
    setCriteria(next);
    setPending(true);
    const res = await reorderCriteria({
      rubricId: rubric.id,
      criterionIds: next.map((c) => c.id),
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  const totalPoints = criteria.reduce((a, c) => a + (Number(c.max_points) || 0), 0);

  return (
    <>
      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>RUBRIC INFO</Eyebrow>
        <div className="cq-field" style={{ marginTop: 12 }}>
          <label htmlFor="rname">Name</label>
          <input
            id="rname"
            className="cq-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="cq-field">
          <label htmlFor="rdesc">Description</label>
          <textarea
            id="rdesc"
            className="cq-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="cq-field">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
            />
            <span>Show this rubric to learners before they submit</span>
          </label>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <Btn sm onClick={saveRubric} disabled={pending}>
            {pending ? "SAVING…" : "SAVE RUBRIC"} <Icon name="check" />
          </Btn>
          <Btn sm ghost onClick={removeRubric} disabled={pending}>
            <Icon name="trash" /> DELETE
          </Btn>
        </div>
      </Frame>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <Eyebrow>CRITERIA · {criteria.length}</Eyebrow>
        <Chip>{totalPoints} TOTAL PTS</Chip>
      </div>

      {criteria.length === 0 ? (
        <Frame style={{ padding: 24, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>No criteria yet.</p>
        </Frame>
      ) : (
        criteria.map((c, idx) => (
          <Frame key={c.id} style={{ padding: 16, marginBottom: 12 }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="cq-mono" style={{ fontSize: 12 }}>
                {String(idx + 1).padStart(2, "0")} ·{" "}
                <span style={{ color: "var(--muted)" }}>ORDER</span>
              </span>
              <div className="row" style={{ gap: 4 }}>
                <IconBtn
                  aria-label="Move up"
                  disabled={idx === 0 || pending}
                  onClick={() => move(idx, -1)}
                  style={{ width: 30, height: 30 }}
                >
                  ↑
                </IconBtn>
                <IconBtn
                  aria-label="Move down"
                  disabled={idx === criteria.length - 1 || pending}
                  onClick={() => move(idx, 1)}
                  style={{ width: 30, height: 30 }}
                >
                  ↓
                </IconBtn>
                <IconBtn
                  aria-label="Delete criterion"
                  onClick={() => removeCriterion(idx)}
                  style={{ width: 30, height: 30 }}
                >
                  <Icon name="trash" size={12} />
                </IconBtn>
              </div>
            </div>
            <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
              <div className="cq-field" style={{ flex: 1 }}>
                <label>Name</label>
                <input
                  className="cq-input"
                  value={c.name}
                  onChange={(e) => patchLocal(idx, { name: e.target.value })}
                />
              </div>
              <div className="cq-field" style={{ width: 140 }}>
                <label>Max points</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="cq-input"
                  value={c.max_points}
                  onChange={(e) => patchLocal(idx, { max_points: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="cq-field">
              <label>Description (what counts as &quot;meets&quot;)</label>
              <textarea
                className="cq-textarea"
                value={c.description}
                onChange={(e) => patchLocal(idx, { description: e.target.value })}
              />
            </div>
            <div>
              <Btn sm onClick={() => saveCriterion(idx)} disabled={pending}>
                {pending ? "SAVING…" : "SAVE"} <Icon name="check" />
              </Btn>
            </div>
          </Frame>
        ))
      )}
      <Btn sm ghost onClick={addCriterion} disabled={pending}>
        <Icon name="plus" /> ADD CRITERION
      </Btn>

      {attachedTo.length > 0 ? (
        <Frame style={{ padding: 16, marginTop: 24 }}>
          <Eyebrow>ATTACHED TO {attachedTo.length} CHATBOT NODE(S)</Eyebrow>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
            {attachedTo.map((a) => (
              <li
                key={a.nodeId}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                ■ {a.programTitle} · <strong>{a.nodeTitle}</strong>
                <Link
                  href={`/programs/${a.programId}/nodes/${a.nodeId}`}
                  style={{ marginLeft: "auto", textDecoration: "underline" }}
                >
                  EDIT NODE
                </Link>
              </li>
            ))}
          </ul>
        </Frame>
      ) : null}
    </>
  );
}
