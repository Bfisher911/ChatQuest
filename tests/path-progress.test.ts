import { describe, expect, test } from "vitest";
import {
  computeProgress,
  type PathNodeMin,
  type PathEdgeMin,
  type SubmissionMin,
} from "@/lib/path/progress";

const node = (id: string, type: string, order: number, opts?: Partial<PathNodeMin>): PathNodeMin => ({
  id,
  type,
  display_order: order,
  available_at: null,
  due_at: null,
  is_required: true,
  ...opts,
});

const submitted = (nodeId: string, percentage: number | null = 100): SubmissionMin => ({
  node_id: nodeId,
  attempt_number: 1,
  status: "graded",
  percentage,
  delivery_status: "on_time",
});

describe("computeProgress", () => {
  test("first node with no prereqs is available", () => {
    const r = computeProgress({
      nodes: [node("a", "content", 0)],
      edges: [],
      rules: [],
      submissions: [],
    });
    expect(r.get("a")?.state).toBe("available");
  });

  test("node behind a prereq is locked until prereq completes", () => {
    const nodes = [node("a", "content", 0), node("b", "bot", 1)];
    const edges: PathEdgeMin[] = [{ source_node_id: "a", target_node_id: "b", condition: null }];
    const r1 = computeProgress({ nodes, edges, rules: [], submissions: [] });
    expect(r1.get("b")?.state).toBe("locked");

    const r2 = computeProgress({
      nodes,
      edges,
      rules: [],
      submissions: [submitted("a", 100)],
    });
    expect(r2.get("a")?.state).toBe("completed");
    expect(r2.get("b")?.state).toBe("available");
  });

  test("min_score edge gates downstream node", () => {
    const nodes = [node("a", "bot", 0), node("b", "bot", 1)];
    const edges: PathEdgeMin[] = [
      { source_node_id: "a", target_node_id: "b", condition: { kind: "min_score", node_id: "a", min_percentage: 80 } },
    ];
    const fail = computeProgress({ nodes, edges, rules: [], submissions: [submitted("a", 60)] });
    expect(fail.get("b")?.state).toBe("locked");
    const pass = computeProgress({ nodes, edges, rules: [], submissions: [submitted("a", 90)] });
    expect(pass.get("b")?.state).toBe("available");
  });

  test("either_or rule unlocks if any prereq complete", () => {
    const nodes = [node("a", "content", 0), node("b", "content", 1), node("c", "bot", 2)];
    const r = computeProgress({
      nodes,
      edges: [],
      rules: [{ node_id: "c", rule_kind: "either_or", config: { node_ids: ["a", "b"] } }],
      submissions: [submitted("a", 100)],
    });
    expect(r.get("c")?.state).toBe("available");
  });

  test("needs_revision marks node failed (not completed)", () => {
    const nodes = [node("a", "bot", 0)];
    const r = computeProgress({
      nodes,
      edges: [],
      rules: [],
      submissions: [
        { node_id: "a", attempt_number: 1, status: "needs_revision", percentage: 60, delivery_status: "on_time" },
      ],
    });
    expect(r.get("a")?.state).toBe("failed");
  });

  test("date gate keeps node locked until available_at", () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const nodes = [node("a", "content", 0, { available_at: future })];
    const r = computeProgress({ nodes, edges: [], rules: [], submissions: [] });
    expect(r.get("a")?.state).toBe("locked");
  });
});
