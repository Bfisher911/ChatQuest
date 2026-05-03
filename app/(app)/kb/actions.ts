"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

const KB_BUCKET = "kb-files";

/**
 * Returns a short-lived signed URL for downloading a KB file.
 * Caller must be in the file's organization (RLS-checked via the user-scoped
 * Supabase client first).
 */
export async function getKbFileSignedUrl(fileId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };

  const admin = createServiceRoleClient();
  const { data: file } = await admin
    .from("knowledge_files")
    .select("id, storage_path, organization_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { ok: false as const, error: "File not found" };
  if (file.organization_id !== session.activeOrganizationId && !session.user.isSuperAdmin) {
    return { ok: false as const, error: "Wrong organization." };
  }

  const { data: signed, error } = await admin.storage
    .from(KB_BUCKET)
    .createSignedUrl(file.storage_path, 60 * 5); // 5 min — enough for a click-through.
  if (error || !signed?.signedUrl) {
    return { ok: false as const, error: error?.message ?? "Failed to sign URL" };
  }
  return { ok: true as const, url: signed.signedUrl };
}
