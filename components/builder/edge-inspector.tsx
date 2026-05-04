"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Eyebrow, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { updateEdgeCondition, deleteEdge } from "@/lib/path/actions";
import type { EdgeCondition } from "@/lib/db/types";

interface SiblingNode {
  id: string;
  title: string;
  type: string;
}

type Kind = "none" | EdgeCondition["kind"];

/**
 * Inspector that swaps into the right rail when an edge is selected in
 * the path builder. Provides a typed form for setting condition kinds:
 *
 *   - none       : plain sequencer ("must complete source first")
 *   - after      : explicit prereq on a chosen node
 *   - min_score  : prereq + score threshold
 *   - date       : unlock on date
 *   - either     : OR-of-prereqs gate
 */
export function EdgeInspector({
  programId,
  sourceNodeId,
  targetNodeId,
  initialCondition,
  siblings,
  onClose,
  onChange,
}: {
  programId: string;
  sourceNodeId: string;
  targetNodeId: string;
  initialCondition: EdgeCondition | null;
  siblings: SiblingNode[];
  onClose: () => void;
  onChange?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const [kind, setKind] = React.useState<Kind>(initialCondition?.kind ?? "none");
  const [nodeId, setNodeId] = React.useState<string>(
    initialCondition && "node_id" in initialCondition ? initialCondition.node_id : sourceNodeId,
  );
  const [minPct, setMinPct] = React.useState<number>(
    initialCondition?.kind === "min_score" ? initialCondition.min_percentage : 70,
  );
  const [availableAt, setAvailableAt] = React.useState<string>(
    initialCondition?.kind === "date" ? initialCondition.available_at.slice(0, 16) : "",
  );
  const [anyOf, setAnyOf] = React.useState<string[]>(
    initialCondition?.kind === "either" ? initialCondition.any_of : [],
  );

  function buildCondition(): EdgeCondition | null {
    if (kind === "none") return null;
    if (kind === "after") return { kind: "after", node_id: nodeId };
    if (kind === "min_score") return { kind: "min_score", node_id: nodeId, min_percentage: Number(minPct) };
    if (kind === "date") return { kind: "date", available_at: new Date(availableAt).toISOString() };
    if (kind === "either") return { kind: "either", any_of: anyOf };
    return null;
  }

  async function save() {
    let condition: EdgeCondition | null;
    try {
      condition = buildCondition();
    } catch {
      toast.error("Invalid condition input");
      return;
    }
    if (kind === "either" && anyOf.length === 0) {
      toast.error("EITHER condition needs at least one node selected.");
      return;
    }
    if (kind === "date" && !availableAt) {
      toast.error("Pick a date.");
      return;
    }
    setPending(true);
    const res = await updateEdgeCondition({
      programId,
      sourceNodeId,
      targetNodeId,
      condition,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Edge updated.");
    onChange?.();
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this edge? Connected nodes will no longer be linked.")) return;
    setPending(true);
    const res = await deleteEdge(programId, sourceNodeId, targetNodeId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Edge deleted.");
    onClose();
    router.refresh();
  }

  const sourceNode = siblings.find((n) => n.id === sourceNodeId);
  const targetNode = siblings.find((n) => n.id === targetNodeId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="row-between" style={{ alignItems: "center" }}>
        <Eyebrow>EDGE</Eyebrow>
        <button
          type="button"
          onClick={onClose}
          className="cq-btn cq-btn--ghost cq-btn--sm"
          aria-label="Close"
        >
          <Icon name="x" />
        </button>
      </div>

      <div
        style={{
          padding: 10,
          background: "var(--soft)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <div>
          <Chip ghost>FROM</Chip> {sourceNode?.title ?? "?"}
        </div>
        <div style={{ marginTop: 4 }}>
          <Chip ghost>TO</Chip> {targetNode?.title ?? "?"}
        </div>
      </div>

      <div>
        <Field label="CONDITION KIND">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            disabled={pending}
            className="cq-input"
            style={inputStyle}
          >
            <option value="none">None — plain sequencer</option>
            <option value="after">AFTER — must complete a node</option>
            <option value="min_score">MIN SCORE — score gate</option>
            <option value="date">DATE — unlock on date</option>
            <option value="either">EITHER — any of these nodes</option>
          </select>
        </Field>

        {kind === "after" || kind === "min_score" ? (
          <Field label="REQUIRED NODE">
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              disabled={pending}
              style={inputStyle}
            >
              {siblings.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title} ({n.type})
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {kind === "min_score" ? (
          <Field label="MIN PERCENTAGE">
            <input
              type="number"
              min={0}
              max={100}
              value={minPct}
              onChange={(e) => setMinPct(Number(e.target.value))}
              disabled={pending}
              style={inputStyle}
            />
          </Field>
        ) : null}

        {kind === "date" ? (
          <Field label="AVAILABLE AT">
            <input
              type="datetime-local"
              value={availableAt}
              onChange={(e) => setAvailableAt(e.target.value)}
              disabled={pending}
              style={inputStyle}
            />
          </Field>
        ) : null}

        {kind === "either" ? (
          <Field label="ANY OF (CHECK ONE OR MORE)">
            <div style={{ maxHeight: 220, overflowY: "auto", border: "var(--hair) solid var(--ink)", padding: 8 }}>
              {siblings.map((n) => {
                const checked = anyOf.includes(n.id);
                return (
                  <label
                    key={n.id}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      padding: "4px 0",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setAnyOf((prev) =>
                          e.target.checked ? [...prev, n.id] : prev.filter((id) => id !== n.id),
                        );
                      }}
                    />
                    {n.title} <span style={{ color: "var(--muted)" }}>({n.type})</span>
                  </label>
                );
              })}
            </div>
          </Field>
        ) : null}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <Btn sm disabled={pending} onClick={save}>
          {pending ? "…" : "SAVE EDGE"}
        </Btn>
        <Btn sm ghost disabled={pending} onClick={remove}>
          <Icon name="trash" /> DELETE EDGE
        </Btn>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        className="cq-mono"
        style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  border: "var(--hair) solid var(--ink)",
  background: "var(--paper)",
};

/**
 * Compact human-readable label for an edge condition — used as the
 * EdgeLabelRenderer text on the canvas so creators see gating at a
 * glance without opening the inspector.
 */
export function describeCondition(condition: EdgeCondition | null): string {
  if (!condition) return "";
  switch (condition.kind) {
    case "after":
      return "AFTER";
    case "min_score":
      return `MIN ${condition.min_percentage}%`;
    case "date":
      return `≥ ${condition.available_at.slice(0, 10)}`;
    case "either":
      return `EITHER · ${condition.any_of.length}`;
  }
}
