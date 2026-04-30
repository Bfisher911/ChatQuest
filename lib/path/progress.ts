// Pure path logic engine.
// Given the full path graph + a learner's progress, computes the state of
// every node (locked / available / in_progress / completed / failed).
//
// All inputs are plain data — this module has no Supabase imports — so it
// can be unit-tested cheaply and reused in both server and client contexts.

import type { EdgeCondition, NodeRuleConfig, ProgressState } from "@/lib/db/types";

export interface PathNodeMin {
  id: string;
  type: string;
  display_order: number;
  available_at: string | null;
  due_at: string | null;
  is_required: boolean;
}

export interface PathEdgeMin {
  source_node_id: string;
  target_node_id: string;
  condition: EdgeCondition | null;
}

export interface NodeRuleMin {
  node_id: string;
  rule_kind: string;
  config: NodeRuleConfig | Record<string, unknown>;
}

export interface SubmissionMin {
  node_id: string;
  attempt_number: number;
  status: "submitted" | "graded" | "needs_revision" | "completed" | "in_progress";
  percentage: number | null; // null = no score yet
  delivery_status: string | null;
}

export interface ProgressInput {
  nodes: PathNodeMin[];
  edges: PathEdgeMin[];
  rules: NodeRuleMin[];
  submissions: SubmissionMin[];
  /** Override clock for testing. */
  now?: Date;
}

export interface NodeProgress {
  state: ProgressState;
  score_percentage: number | null;
  attempts_used: number;
  reasons: string[];
}

export type ProgressMap = Map<string, NodeProgress>;

/**
 * Compute the progress state of every node in a program for one learner.
 *
 * Rules:
 *  - A node is **completed** if a submission exists with status `graded`,
 *    `completed`, or `submitted` AND (no min-score gate OR percentage ≥ gate).
 *  - It is **failed** if a submission exists with `needs_revision` and no
 *    follow-up submission has been made.
 *  - It is **in_progress** if a submission exists with `in_progress` (mostly
 *    just chatbot conversations — other node types complete instantly).
 *  - It is **available** if all incoming edges' source nodes are completed
 *    (or there are no incoming edges) AND any `node_rules` pass AND the
 *    `available_at` date has passed.
 *  - Otherwise it is **locked**.
 *
 * Edges with no `condition` mean "the source must be completed before the
 * target unlocks". With a `condition` of kind `min_score`, the source must
 * be completed AND its score must meet the threshold for the edge to "open".
 * `either` means any of the listed nodes' completion opens the edge.
 */
export function computeProgress(input: ProgressInput): ProgressMap {
  const now = input.now ?? new Date();
  const out: ProgressMap = new Map();

  // Index helpers
  const submissionsByNode = new Map<string, SubmissionMin[]>();
  for (const s of input.submissions) {
    const arr = submissionsByNode.get(s.node_id) ?? [];
    arr.push(s);
    submissionsByNode.set(s.node_id, arr);
  }
  const incomingEdgesByNode = new Map<string, PathEdgeMin[]>();
  for (const e of input.edges) {
    const arr = incomingEdgesByNode.get(e.target_node_id) ?? [];
    arr.push(e);
    incomingEdgesByNode.set(e.target_node_id, arr);
  }
  const rulesByNode = new Map<string, NodeRuleMin[]>();
  for (const r of input.rules) {
    const arr = rulesByNode.get(r.node_id) ?? [];
    arr.push(r);
    rulesByNode.set(r.node_id, arr);
  }

  // First pass: classify each node's "own" state from submissions alone.
  function ownState(nodeId: string): NodeProgress {
    const subs = submissionsByNode.get(nodeId) ?? [];
    const attempts_used = subs.length;
    if (subs.length === 0) {
      return { state: "available", score_percentage: null, attempts_used: 0, reasons: [] };
    }
    // Most recent attempt wins.
    const latest = subs[subs.length - 1];
    const score = latest.percentage;
    if (latest.status === "needs_revision") {
      return { state: "failed", score_percentage: score, attempts_used, reasons: ["Returned for revision"] };
    }
    if (latest.status === "in_progress") {
      return { state: "in_progress", score_percentage: score, attempts_used, reasons: [] };
    }
    return { state: "completed", score_percentage: score, attempts_used, reasons: [] };
  }

  // Second pass: gate availability with prereqs + node_rules + dates.
  for (const node of input.nodes) {
    const own = ownState(node.id);

    // If already done / failed / in-progress, that wins.
    if (own.state !== "available") {
      out.set(node.id, own);
      continue;
    }

    const reasons: string[] = [];

    // Available-at date gate
    if (node.available_at && new Date(node.available_at) > now) {
      reasons.push(`Opens ${new Date(node.available_at).toISOString().slice(0, 10)}`);
    }

    // Incoming edges: each must "open" — i.e., source completed (and condition met if any).
    const incoming = incomingEdgesByNode.get(node.id) ?? [];
    if (incoming.length > 0) {
      const allOpen = incoming.every((edge) => isEdgeOpen(edge, ownState));
      if (!allOpen) {
        reasons.push("Prerequisite not yet met");
      }
    }

    // Explicit node_rules
    const rules = rulesByNode.get(node.id) ?? [];
    for (const rule of rules) {
      const ruleResult = evaluateRule(rule, ownState, now);
      if (!ruleResult.ok) reasons.push(ruleResult.reason);
    }

    out.set(
      node.id,
      reasons.length > 0
        ? { ...own, state: "locked", reasons }
        : own,
    );
  }

  return out;
}

function isEdgeOpen(
  edge: PathEdgeMin,
  ownState: (id: string) => NodeProgress,
): boolean {
  const src = ownState(edge.source_node_id);
  if (edge.condition === null || edge.condition === undefined) {
    return src.state === "completed";
  }
  switch (edge.condition.kind) {
    case "after":
      return ownState(edge.condition.node_id).state === "completed";
    case "min_score": {
      const dep = ownState(edge.condition.node_id);
      return dep.state === "completed" && (dep.score_percentage ?? 0) >= edge.condition.min_percentage;
    }
    case "date":
      return new Date(edge.condition.available_at) <= new Date();
    case "either":
      return edge.condition.any_of.some((id) => ownState(id).state === "completed");
    default:
      return src.state === "completed";
  }
}

function evaluateRule(
  rule: NodeRuleMin,
  ownState: (id: string) => NodeProgress,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  const cfg = rule.config as Record<string, unknown>;
  switch (rule.rule_kind) {
    case "open_on_date": {
      const at = String(cfg.available_at ?? "");
      if (!at) return { ok: true };
      return new Date(at) <= now
        ? { ok: true }
        : { ok: false, reason: `Opens ${new Date(at).toISOString().slice(0, 10)}` };
    }
    case "after_prereq": {
      const ids = (cfg.node_ids as string[]) ?? [];
      const pending = ids.filter((id) => ownState(id).state !== "completed");
      return pending.length === 0 ? { ok: true } : { ok: false, reason: `${pending.length} prerequisite(s) remaining` };
    }
    case "min_score": {
      const id = String(cfg.node_id ?? "");
      const min = Number(cfg.min_percentage ?? 0);
      const dep = ownState(id);
      return dep.state === "completed" && (dep.score_percentage ?? 0) >= min
        ? { ok: true }
        : { ok: false, reason: `Need ${min}% on prerequisite` };
    }
    case "either_or": {
      const ids = (cfg.node_ids as string[]) ?? [];
      return ids.some((id) => ownState(id).state === "completed")
        ? { ok: true }
        : { ok: false, reason: "Complete one of the prerequisite nodes" };
    }
    default:
      return { ok: true };
  }
}
