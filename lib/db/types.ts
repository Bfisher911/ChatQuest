// Shape of polymorphic jsonb config columns.
// These types are NOT enforced by Postgres — the application is the source of truth.
//
// Whenever you write to path_nodes.config or path_edges.condition, validate with
// the matching zod schema in lib/validation/.

export type NodeType = "bot" | "content" | "pdf" | "slides" | "link" | "milestone" | "cert";

export interface BotNodeConfig {
  // chatbot_configs row holds the real bot config; this is empty for bot nodes.
  // Kept as a type marker for symmetry.
}

export interface ContentNodeConfig {
  body_html: string;
  reading_minutes?: number;
  require_completion_check?: boolean;
}

export interface PdfNodeConfig {
  storage_path: string;
  filename: string;
  page_count?: number;
  require_acknowledgement?: boolean;
}

export interface SlidesNodeConfig {
  slides: { title: string; body: string; image_url?: string }[];
}

export interface LinkNodeConfig {
  url: string;
  description?: string;
  open_in_new_tab?: boolean;
  require_confirmation?: boolean;
}

export interface MilestoneNodeConfig {
  required_node_ids: string[];
  min_grade_percentage?: number;
  awards_certificate_id?: string;
}

export interface CertNodeConfig {
  certificate_id?: string; // FK to certificates row, set after cert is created
}

export type NodeConfigByType = {
  bot: BotNodeConfig;
  content: ContentNodeConfig;
  pdf: PdfNodeConfig;
  slides: SlidesNodeConfig;
  link: LinkNodeConfig;
  milestone: MilestoneNodeConfig;
  cert: CertNodeConfig;
};

export type AnyNodeConfig = NodeConfigByType[NodeType];

// path_edges.condition shapes.
export type EdgeCondition =
  | { kind: "after"; node_id: string }
  | { kind: "min_score"; node_id: string; min_percentage: number }
  | { kind: "date"; available_at: string }
  | { kind: "either"; any_of: string[] };

// node_rules.config shapes.
export type NodeRuleConfig =
  | { kind: "open_on_date"; available_at: string }
  | { kind: "after_prereq"; node_ids: string[] }
  | { kind: "min_score"; node_id: string; min_percentage: number }
  | { kind: "either_or"; node_ids: string[] }
  | { kind: "branching"; on_pass: string; on_fail?: string }
  | { kind: "skip"; condition: string };

export type ProgressState = "locked" | "available" | "in_progress" | "completed" | "failed";

export interface NodeProgress {
  node_id: string;
  state: ProgressState;
  score_percentage?: number;
  attempts_used: number;
  attempts_remaining: number;
  due_at?: string;
  available_at?: string;
}

export type UserRole = "super_admin" | "org_admin" | "instructor" | "ta" | "learner";

export type ConversationStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "needs_revision"
  | "completed";

export type GradeStatus =
  | "not_submitted"
  | "pending_review"
  | "in_review"
  | "graded"
  | "needs_revision"
  | "excused";
