// Drizzle schema mirroring the SQL migrations under supabase/migrations/.
// Use this file for type inference and for any Drizzle-driven queries (server-side only).
//
// IMPORTANT: SQL is the source of truth. If you change a migration, update this file too.

import {
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// We don't operate on the auth schema from Drizzle, but we reference auth.users(id).
// pgvector type — Drizzle 0.36 doesn't ship a built-in for it.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dim = (config as { dimensions?: number } | undefined)?.dimensions ?? 1536;
    return `vector(${dim})`;
  },
});

// ───────── enums ─────────
// Using pgSchema('app') so Drizzle understands these live in the `app` schema.
const appSchema = pgSchema("app");

export const userRoleEnum = appSchema.enum("user_role", [
  "super_admin",
  "org_admin",
  "instructor",
  "ta",
  "learner",
]);

export const inviteStatusEnum = appSchema.enum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const programStatusEnum = appSchema.enum("program_status", [
  "draft",
  "published",
  "archived",
]);

export const enrollmentTypeEnum = appSchema.enum("enrollment_type", [
  "invite_only",
  "invite_code",
  "open",
]);

export const enrollmentStatusEnum = appSchema.enum("enrollment_status", [
  "active",
  "completed",
  "dropped",
  "pending",
]);

export const nodeTypeEnum = appSchema.enum("node_type", [
  "bot",
  "content",
  "pdf",
  "slides",
  "link",
  "milestone",
  "cert",
]);

export const nodeProgressStateEnum = appSchema.enum("node_progress_state", [
  "locked",
  "available",
  "in_progress",
  "completed",
  "failed",
]);

export const kbFileStatusEnum = appSchema.enum("kb_file_status", [
  "pending",
  "processing",
  "indexed",
  "failed",
]);

export const conversationStatusEnum = appSchema.enum("conversation_status", [
  "not_started",
  "in_progress",
  "submitted",
  "graded",
  "needs_revision",
  "completed",
]);

export const messageRoleEnum = appSchema.enum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const gradeStatusEnum = appSchema.enum("grade_status", [
  "not_submitted",
  "pending_review",
  "in_review",
  "graded",
  "needs_revision",
  "excused",
]);

export const subscriptionStatusEnum = appSchema.enum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);

export const seatPoolKindEnum = appSchema.enum("seat_pool_kind", ["instructor", "learner"]);

// ───────── tables ─────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  orgType: text("org_type").default("other"),
  stripeCustomerId: text("stripe_customer_id"),
  planCode: text("plan_code").default("free"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: userRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({
    uq: unique().on(t.organizationId, t.userId),
    userIdx: index("organization_members_user_idx").on(t.userId),
  }),
);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  programId: uuid("program_id"),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull(),
  token: text("token").notNull().unique(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  invitedBy: uuid("invited_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  createdBy: uuid("created_by"),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  status: programStatusEnum("status").notNull().default("draft"),
  enrollmentType: enrollmentTypeEnum("enrollment_type").notNull().default("invite_only"),
  inviteCode: text("invite_code"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  availableAt: timestamp("available_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  passingThreshold: numeric("passing_threshold", { precision: 5, scale: 2 }).default("70.00"),
  defaultModel: text("default_model").default("gemini-3-flash-preview"),
  monthlyTokenBudget: integer("monthly_token_budget").default(200000),
  learnerPays: boolean("learner_pays").notNull().default(false),
  learnerPriceCents: integer("learner_price_cents"),
  shareConversationsWithOrgAdmin: boolean("share_conversations_with_org_admin")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const programInstructors = pgTable(
  "program_instructors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull(),
    userId: uuid("user_id").notNull(),
    capacity: text("capacity").notNull().default("co_instructor"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uq: unique().on(t.programId, t.userId) }),
);

export const programEnrollments = pgTable(
  "program_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull(),
    userId: uuid("user_id").notNull(),
    status: enrollmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    finalGrade: numeric("final_grade", { precision: 5, scale: 2 }),
  },
  (t) => ({ uq: unique().on(t.programId, t.userId) }),
);

export const pathNodes = pgTable("path_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id").notNull(),
  type: nodeTypeEnum("type").notNull(),
  title: text("title").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  x: numeric("x").default("0"),
  y: numeric("y").default("0"),
  config: jsonb("config").notNull().default({}),
  points: integer("points").default(0),
  isRequired: boolean("is_required").notNull().default(true),
  availableAt: timestamp("available_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  untilAt: timestamp("until_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pathEdges = pgTable(
  "path_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull(),
    sourceNodeId: uuid("source_node_id").notNull(),
    targetNodeId: uuid("target_node_id").notNull(),
    condition: jsonb("condition"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uq: unique().on(t.sourceNodeId, t.targetNodeId) }),
);

export const nodeRules = pgTable("node_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id").notNull(),
  ruleKind: text("rule_kind").notNull(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatbotConfigs = pgTable("chatbot_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id").notNull().unique(),
  botName: text("bot_name").default("AI Tutor"),
  avatarInitials: text("avatar_initials").default("AI"),
  learnerInstructions: text("learner_instructions"),
  systemPrompt: text("system_prompt").notNull(),
  conversationGoal: text("conversation_goal"),
  completionCriteria: text("completion_criteria"),
  model: text("model").notNull().default("gemini-3-flash-preview"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).notNull().default("0.4"),
  maxTokens: integer("max_tokens").notNull().default(1024),
  tokenBudget: integer("token_budget").notNull().default(8000),
  attemptsAllowed: integer("attempts_allowed").notNull().default(2),
  endAfterTurns: integer("end_after_turns"),
  endWhenObjectiveMet: boolean("end_when_objective_met").notNull().default(false),
  requireSubmitButton: boolean("require_submit_button").notNull().default(true),
  produceCompletionSummary: boolean("produce_completion_summary").notNull().default(true),
  askReflectionQuestions: boolean("ask_reflection_questions").notNull().default(false),
  allowRetryAfterFeedback: boolean("allow_retry_after_feedback").notNull().default(true),
  rubricId: uuid("rubric_id"),
  aiGradingEnabled: boolean("ai_grading_enabled").notNull().default(true),
  usePogramKb: boolean("use_program_kb").notNull().default(true),
  nodeKbId: uuid("node_kb_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeCollections = pgTable("knowledge_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  programId: uuid("program_id"),
  nodeId: uuid("node_id"),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeFiles = pgTable("knowledge_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  bytes: integer("bytes"),
  pages: integer("pages"),
  status: kbFileStatusEnum("status").notNull().default("pending"),
  statusMessage: text("status_message"),
  uploadedBy: uuid("uploaded_by"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  indexedAt: timestamp("indexed_at", { withTimezone: true }),
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull(),
  collectionId: uuid("collection_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  pageNumber: integer("page_number"),
  tokenCount: integer("token_count"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  chunkId: uuid("chunk_id").notNull().unique(),
  collectionId: uuid("collection_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  model: text("model").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").notNull(),
    nodeId: uuid("node_id").notNull(),
    learnerId: uuid("learner_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: conversationStatusEnum("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalPromptTokens: integer("total_prompt_tokens").notNull().default(0),
    totalCompletionTokens: integer("total_completion_tokens").notNull().default(0),
    aiSummary: text("ai_summary"),
  },
  (t) => ({
    uq: unique().on(t.programId, t.nodeId, t.learnerId, t.attemptNumber),
  }),
);

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  citations: jsonb("citations").default([]),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().unique(),
  programId: uuid("program_id").notNull(),
  nodeId: uuid("node_id").notNull(),
  learnerId: uuid("learner_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  deliveryStatus: text("delivery_status").notNull().default("on_time"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  organizationId: uuid("organization_id"),
  userId: uuid("user_id"),
  programId: uuid("program_id"),
  nodeId: uuid("node_id"),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rubrics = pgTable("rubrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  programId: uuid("program_id"),
  name: text("name").notNull(),
  description: text("description"),
  totalPoints: integer("total_points").notNull().default(0),
  isVisibleToLearners: boolean("is_visible_to_learners").notNull().default(false),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rubricCriteria = pgTable("rubric_criteria", {
  id: uuid("id").primaryKey().defaultRandom(),
  rubricId: uuid("rubric_id").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  name: text("name").notNull(),
  description: text("description"),
  maxPoints: integer("max_points").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rubricLevels = pgTable("rubric_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  criterionId: uuid("criterion_id").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  label: text("label").notNull(),
  points: integer("points").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const grades = pgTable("grades", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().unique(),
  conversationId: uuid("conversation_id").notNull(),
  programId: uuid("program_id").notNull(),
  nodeId: uuid("node_id").notNull(),
  learnerId: uuid("learner_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  rubricId: uuid("rubric_id"),
  status: gradeStatusEnum("status").notNull().default("pending_review"),
  score: numeric("score", { precision: 6, scale: 2 }),
  maxScore: numeric("max_score", { precision: 6, scale: 2 }),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  instructorComment: text("instructor_comment"),
  aiSuggestedScore: numeric("ai_suggested_score", { precision: 6, scale: 2 }),
  aiSummary: text("ai_summary"),
  gradedBy: uuid("graded_by"),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rubricScores = pgTable(
  "rubric_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gradeId: uuid("grade_id").notNull(),
    criterionId: uuid("criterion_id").notNull(),
    levelId: uuid("level_id"),
    score: numeric("score", { precision: 6, scale: 2 }).notNull().default("0"),
    comment: text("comment"),
  },
  (t) => ({ uq: unique().on(t.gradeId, t.criterionId) }),
);

export const certificateTemplates = pgTable("certificate_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().default("brutalist-default"),
  bodyText: text("body_text"),
  signerName: text("signer_name"),
  signerTitle: text("signer_title"),
  signatureImageUrl: text("signature_image_url"),
  orgLogoUrl: text("org_logo_url"),
  paperSize: text("paper_size").notNull().default("Letter-landscape"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id").notNull(),
  nodeId: uuid("node_id"),
  templateId: uuid("template_id").notNull(),
  title: text("title").notNull(),
  requiredNodeIds: jsonb("required_node_ids").notNull().default([]),
  minGradePercentage: numeric("min_grade_percentage", { precision: 5, scale: 2 }).default("80.00"),
  requiresInstructorApproval: boolean("requires_instructor_approval").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certificateAwards = pgTable("certificate_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  certificateId: uuid("certificate_id").notNull(),
  programId: uuid("program_id").notNull(),
  learnerId: uuid("learner_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  verificationCode: text("verification_code").notNull().unique(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  awardedBy: uuid("awarded_by"),
  pdfPath: text("pdf_path"),
});

export const plans = pgTable("plans", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  monthlyPriceCents: integer("monthly_price_cents").default(0),
  annualPriceCents: integer("annual_price_cents").default(0),
  instructorSeats: integer("instructor_seats").default(1),
  learnerSeats: integer("learner_seats").default(0),
  monthlyTokenBudget: integer("monthly_token_budget").default(200000),
  features: jsonb("features").default({}),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").default(0),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  userId: uuid("user_id"),
  planCode: text("plan_code").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seatPools = pgTable("seat_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  userId: uuid("user_id"),
  kind: seatPoolKindEnum("kind").notNull(),
  totalSeats: integer("total_seats").notNull().default(0),
  usedSeats: integer("used_seats").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seatAssignments = pgTable(
  "seat_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seatPoolId: uuid("seat_pool_id").notNull(),
    userId: uuid("user_id").notNull(),
    programId: uuid("program_id"),
    status: text("status").notNull().default("active"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (t) => ({ uq: unique().on(t.seatPoolId, t.userId, t.programId) }),
);

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  userId: uuid("user_id"),
  stripeEventId: text("stripe_event_id").unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageLogs = pgTable("usage_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  organizationId: uuid("organization_id"),
  programId: uuid("program_id"),
  nodeId: uuid("node_id"),
  conversationId: uuid("conversation_id"),
  userId: uuid("user_id"),
  kind: text("kind").notNull(),
  model: text("model"),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  estCostUsd: numeric("est_cost_usd", { precision: 10, scale: 6 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Type exports for inference.
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type PathNode = typeof pathNodes.$inferSelect;
export type ChatbotConfig = typeof chatbotConfigs.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Grade = typeof grades.$inferSelect;
export type Rubric = typeof rubrics.$inferSelect;
export type RubricCriterion = typeof rubricCriteria.$inferSelect;
export type RubricLevel = typeof rubricLevels.$inferSelect;
export type RubricScore = typeof rubricScores.$inferSelect;
export type CertificateAward = typeof certificateAwards.$inferSelect;
export type KnowledgeCollection = typeof knowledgeCollections.$inferSelect;
export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type ProgramEnrollment = typeof programEnrollments.$inferSelect;
export type Plan = typeof plans.$inferSelect;
