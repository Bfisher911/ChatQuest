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
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  deleteEdge,
} from "@/lib/path/actions";
import type { NodeType } from "@/lib/db/types";
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
}: {
  programId: string;
  initialNodes: PathNodeMin[];
  initialEdges: PathEdgeMin[];
}) {
  return (
    <ReactFlowProvider>
      <PathBuilderInner programId={programId} initialNodes={initialNodes} initialEdges={initialEdges} />
    </ReactFlowProvider>
  );
}

function PathBuilderInner({
  programId,
  initialNodes,
  initialEdges,
}: {
  programId: string;
  initialNodes: PathNodeMin[];
  initialEdges: PathEdgeMin[];
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
    initialEdges.map((e, i) => ({
      id: `${e.source_node_id}->${e.target_node_id}`,
      source: e.source_node_id,
      target: e.target_node_id,
      style: { stroke: "var(--ink)", strokeWidth: 2 },
      markerEnd: { type: "arrow", color: "var(--ink)" },
      data: { condition: e.condition },
    })),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(initialNodes[0]?.id ?? null);

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
          void deleteEdge(programId, removed.source, removed.target);
        }
      }
    }
  };

  const onConnect: OnConnect = (params) => {
    if (!params.source || !params.target) return;
    setEdges((es) => addEdge(
      { ...params, style: { stroke: "var(--ink)", strokeWidth: 2 }, markerEnd: { type: "arrow", color: "var(--ink)" } },
      es,
    ));
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
          · Click an edge + DEL to remove<br />
          · Click a node to inspect →
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
          onNodeClick={(_e, n) => setSelectedId(n.id)}
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

      {/* RIGHT: inspector */}
      <aside className="cq-pb__inspector">
        {selectedNode ? (
          <NodeInspector
            programId={programId}
            node={selectedNode}
            onChange={() => router.refresh()}
            onDelete={removeSelected}
          />
        ) : (
          <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
            Click a node to inspect.
          </div>
        )}
      </aside>
    </div>
  );
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

interface InspectorProps {
  programId: string;
  node: PathNodeMin;
  onChange: () => void;
  onDelete: () => void;
}

function NodeInspector({ programId, node, onChange, onDelete }: InspectorProps) {
  const [pending, setPending] = React.useState(false);
  const [title, setTitle] = React.useState(node.title);
  const [points, setPoints] = React.useState(String(node.points ?? 0));
  const [isRequired, setIsRequired] = React.useState(node.is_required);
  const [config, setConfig] = React.useState(JSON.stringify(node.config ?? {}, null, 2));

  async function save() {
    setPending(true);
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      toast.error("Config is not valid JSON");
      setPending(false);
      return;
    }
    const res = await updateNode({
      nodeId: node.id,
      programId,
      title,
      points: Number(points),
      isRequired,
      config: parsedConfig,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved.");
    onChange();
  }

  return (
    <>
      <h4>■ INSPECTOR · {bin(node.display_order + 1, 4)}</h4>
      <div className="cq-field">
        <label>Type</label>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip>{node.type.toUpperCase()}</Chip>
        </div>
      </div>
      <div className="cq-field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          className="cq-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
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
        <div className="cq-field">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            <span>Required</span>
          </label>
        </div>
      </div>
      <div className="cq-field">
        <label htmlFor="config">Config (JSON)</label>
        <textarea
          id="config"
          className="cq-textarea"
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          rows={10}
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Btn sm onClick={save} disabled={pending}>
          {pending ? "SAVING…" : "SAVE"} <Icon name="check" />
        </Btn>
        {node.type === "bot" && (
          <Btn sm ghost asChild>
            <a href={`/programs/${programId}/nodes/${node.id}`}>BOT EDITOR <Icon name="arrow" /></a>
          </Btn>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <Btn sm ghost onClick={onDelete}>
          <Icon name="trash" /> DELETE NODE
        </Btn>
      </div>
    </>
  );
}
