// Server-side notification helper. All writes go through the service-role
// client because we want server actions on behalf of one user to fire a
// notification for a *different* user (e.g., instructor saves a grade →
// learner gets a notification).

import { createServiceRoleClient } from "@/lib/supabase/server";

export type NotificationKind =
  | "grade_returned"
  | "cert_awarded"
  | "invite_received"
  | "comment_added"
  | "other";

export interface NewNotification {
  userId: string;
  organizationId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort fire-and-forget. Never throws — notifications must not break
 * the main request path.
 */
export async function createNotification(input: NewNotification): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    await admin.from("notifications").insert({
      user_id: input.userId,
      organization_id: input.organizationId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error("[notifications] create failed:", err);
  }
}
