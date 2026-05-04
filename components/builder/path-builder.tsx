"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Btn, Chip, Eyebrow, Icon, IconBtn } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { cx } from "@/lib/utils/cx";
import {
  NodeInspector as TypedNodeInspector,
  type SiblingNode,
} from "@/components/builder/inspectors";
import { EdgeInspector, describeCondition } from "@/components/builder/edge-inspector";
import {
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  deleteEdge,
} from "@/lib/path/actions";
import type { EdgeCondition, NodeType } from "@/lib/db/types";
import { toast } from "sonner";

interface PathNodeMin {
  id: string;
  type: NodeType;
  title: string;
  display_order: number;
  x: string | number | null;
  y: string | number | null;
  points: number | null;
  is_required: boolean;
  config: Record<string, unknown>;
  available_at: string | null;
  due_at: string | null;
}
interface PathEdgeMin {
  source_node_id: string;
  target_node_id: string;
  condition: Record<string, unknown> | null;
}

export interface RubricMin {
  id: string;
  name: string;
  total_points: number | null;
}

export interface BotConfigMin {
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

const NODE_PALETTE: { type: NodeType; label: string; icon: import("@/components/brutalist").IconName }[] = [
  { type: "bot", label: "Chatbot", icon: "bot" },
  { type: "content", label: "Content", icon: "file" },
  { type: "pdf", label: "PDF / Doc", icon: "book" },
  { type: "slides", label: "Slides", icon: "slides" },
  { type: "link", label: "External", icon: "link" },
  { type: "milestone", label: "Milestone", icon: "flag" },
  { type: "cert", label: "Certificate", icon: "award" },
];

// Custom node renderer that matches the brutalist prototype style.
function BrutalistNode({ data, selected }: { data: { node: PathNodeMin; index: number }; selected: boolean }) {
  const n = data.node;
  const isCert = n.type === "cert";
  const isMilestone = n.type === "milestone";
  return (
    <div
      className={cx(
        "cq-node",
        isCert && "cq-node--cert",
        isMilestone && "cq-node--milestone",
        selected && "is-selected",
      )}
      style={{ position: "relative", left: 0, top: 0, width: isMilestone ? 180 : 220 }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "var(--ink)", width: 8, height: 8 }} />
      <div className="cq-node__head">
        <span className="cq-node__type">{n.type.toUpperCase()}</span>
        <span className="cq-node__idx">{bin(data.index, 4)}</span>
      </div>
      <div className="cq-node__title">{n.title}</div>
      <div className="cq-node__meta">
        <div className="row-between">
          <span>{(n.points ?? 0)} pts</span>
          <span>{n.is_required ? "REQ" : "OPT"}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "var(--ink)", width: 8, height: 8 }} />
    </div>
  );
}

const NODE_TYPES = { brutalist: BrutalistNode };

export function PathBuilder({
  programId,
  initialNodes,
  initialEdges,
  rubrics = [],
  botConfigs = [],
}: {
  programId: string;
  initialNodes: PathNodeMin[];
  initialEdges: PathEdgeMin[];
  rubrics?: RubricMin[];
  botConfigs?: BotConfigMin[];
}) {
  return (
    <ReactFlowProvider>
      <PathBuilderInner
        programId={programId}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        rubrics={rubrics}
        botConfigs={botConfigs}
      />
    </ReactFlowProvider>
  );
}

function PathBuilderInner({
  programId,
  initialNodes,
  initialEdges,
  rubrics,
  botConfigs,
}: {
  programId: string;
  initialNodes: PathNodeMin[];
  initialEdges: PathEdgeMin[];
  rubrics: RubricMin[];
  botConfigs: BotConfigMin[];
}) {
  const router = useRouter();
  const reactFlow = useReactFlow();

  const [nodes, setNodes] = React.useState<Node[]>(() =>
    initialNodes.map((n, i) => ({
      id: n.id,
      type: "brutalist",
      position: { x: Number(n.x ?? 0) || (i % 4) * 280 + 60, y: Number(n.y ?? 0) || Math.floor(i / 4) * 200 + 60 },
      data: { node: n, index: n.display_order + 1 },
    })),
  );
  const [edges, setEdges] = React.useState<Edge[]>(() =>
    initialEdges.map((e) => buildEdge(e.source_node_id, e.target_node_id, e.condition as EdgeCondition | null)),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(initialNodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);

  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    // Persist position changes when the drag ends.
    for (const c of changes) {
      if (c.type === "position" && c.dragging === false && c.position) {
        void updateNode({ nodeId: c.id, programId, x: c.position.x, y: c.position.y });
      }
    }
  };

  const onEdgesChange: OnEdgesChange = (changes) => {
    setEdges((es) => applyEdgeChanges(changes, es));
    for (const c of changes) {
      if (c.type === "remove") {
        const removed = edges.find((e) => e.id === c.id);
        if (removed) {
          if (selectedEdgeId === removed.id) setSelectedEdgeId(null);
          void deleteEdge(programId, removed.source, removed.target);
        }
      }
    }
  };

  const onConnect: OnConnect = (params) => {
    if (!params.source || !params.target) return;
    setEdges((es) => addEdge(buildEdge(params.source!, params.target!, null), es));
    void createEdge({
      programId,
      sourceNodeId: params.source,
      targetNodeId: params.target,
    }).then((res) => {
      if (!res.ok) toast.error(res.error);
    });
  };

  async function addNode(type: NodeType) {
    const title = prompt(`New ${type} node — title?`);
    if (!title) return;
    const center = reactFlow.screenToFlowPosition({ x: 400, y: 240 });
    const points = type === "bot" ? 25 : type === "milestone" ? 0 : type === "cert" ? 0 : 5;
    const res = await createNode({
      programId,
      title,
      type,
      points,
      x: center.x,
      y: center.y,
      isRequired: true,
      config: defaultConfig(type),
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${type} node.`);
    router.refresh();
  }

  async function removeSelected() {
    if (!selectedId) return;
    if (!confirm("Delete this node and its edges?")) return;
    const res = await deleteNode(selectedId, programId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSelectedId(null);
    router.refresh();
  }

  const selectedNode = initialNodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="cq-pb" style={{ height: "calc(100vh - 230px)" }}>
      {/* LEFT: palette */}
      <aside className="cq-pb__rail">
        <h4>■ ADD NODE</h4>
        {NODE_PALETTE.map((p) => (
          <button
            key={p.type}
            onClick={() => addNode(p.type)}
            className="cq-pb__rail-item"
            style={{ width: "100%", textAlign: "left", background: "var(--paper)" }}
          >
            <Icon name={p.icon} size={14} />
            <span>{p.label}</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-pixel)", fontSize: 8 }}>{p.type.toUpperCase()}</span>
          </button>
        ))}
        <h4 style={{ marginTop: 24 }}>■ TIPS</h4>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
          · Drag nodes to lay out<br />
          · Drag handles to connect<br />
          · Click a node to inspect →<br />
          · Click an edge to set conditions<br />
          · Dashed edges have gating<br />
          · Click an edge + DEL to remove
        </div>
      </aside>

      {/* CENTER: canvas */}
      <div style={{ position: "relative", minWidth: 0, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_e, n) => {
            setSelectedId(n.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_e, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedId(null);
          }}
          onPaneClick={() => setSelectedEdgeId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: "var(--paper)" }}
        >
          <Background color="#0001" gap={20} />
          <Controls />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.05)" />
        </ReactFlow>
      </div>

      {/* RIGHT: inspector — node OR edge depending on what's selected */}
      <aside className="cq-pb__inspector">
        {selectedEdgeId ? (
          (() => {
            const edge = edges.find((e) => e.id === selectedEdgeId);
            if (!edge) return null;
            const initialCondition = (edge.data as { condition?: EdgeCondition | null } | undefined)?.condition ?? null;
            return (
              <EdgeInspector
                key={selectedEdgeId}
                programId={programId}
                sourceNodeId={edge.source}
                targetNodeId={edge.target}
                initialCondition={initialCondition}
                siblings={initialNodes.map((n) => ({ id: n.id, title: n.title, type: n.type }))}
                onClose={() => setSelectedEdgeId(null)}
                onChange={() => router.refresh()}
              />
            );
          })()
        ) : selectedNode ? (
          <TypedNodeInspector
            programId={programId}
            rubrics={rubrics}
            botConfig={botConfigs.find((b) => b.node_id === selectedNode.id) ?? null}
            node={{
              id: selectedNode.id,
              type: selectedNode.type,
              title: selectedNode.title,
              display_order: selectedNode.display_order,
              points: selectedNode.points ?? 0,
              is_required: selectedNode.is_required,
              config: (selectedNode.config as Record<string, unknown>) ?? {},
              available_at: selectedNode.available_at,
              due_at: selectedNode.due_at,
            }}
            siblings={initialNodes.map((n) => ({
              id: n.id,
              title: n.title,
              type: n.type,
              display_order: n.display_order,
            })) as SiblingNode[]}
            onChange={() => router.refresh()}
            onDelete={removeSelected}
          />
        ) : (
          <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
            Click a node to inspect — or click an edge to set conditions.
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * Build a React Flow edge with consistent styling and a label that
 * surfaces the gating condition on the canvas (so creators see "MIN 80%"
 * etc. without opening the inspector).
 */
function buildEdge(
  source: string,
  target: string,
  condition: EdgeCondition | null,
): Edge {
  const label = describeCondition(condition);
  const conditional = condition !== null;
  return {
    id: `${source}->${target}`,
    source,
    target,
    label: label || undefined,
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 0,
    labelBgStyle: { fill: "var(--paper)", stroke: "var(--ink)", strokeWidth: 1 },
    labelStyle: {
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      fontWeight: 700,
      fill: "var(--ink)",
    },
    style: {
      stroke: "var(--ink)",
      strokeWidth: conditional ? 2.5 : 2,
      strokeDasharray: conditional ? "4 4" : undefined,
    },
    markerEnd: { type: "arrow", color: "var(--ink)" },
    data: { condition },
  };
}

function defaultConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "content":
      return { body_html: "<p>Content goes here.</p>", reading_minutes: 5 };
    case "pdf":
      return { storage_path: "", filename: "" };
    case "slides":
      return { slides: [{ title: "Slide 1", body: "" }] };
    case "link":
      return { url: "https://", description: "", open_in_new_tab: true };
    case "milestone":
      return { required_node_ids: [], min_grade_percentage: 70 };
    case "cert":
      return { certificate_id: null };
    case "bot":
    default:
      return {};
  }
}

// (Inline NodeInspector removed in Phase R+ — replaced by the typed
// dispatcher in components/builder/inspectors/index.tsx, which renders a
// content-aware form per node type.)
