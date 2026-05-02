"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

const NODE_FILES_BUCKET = "node-files";

const uploadSchema = z.object({
  programId: z.string().uuid(),
  nodeId: z.string().uuid(),
});

const ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".svg"];
const MAX_BYTES = 50 * 1024 * 1024; // 50 MiB (matches storage bucket policy)

/**
 * Upload a file to a path_node's `node-files` bucket folder, then update the
 * node's config jsonb with the storage path.
 *
 * Used by PDF + Slides + Content (image) inspectors.
 *
 * Returns the storage path + a signed URL the inspector can preview.
 */
export async function uploadNodeFile(formData: FormData) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) {
    return { ok: false as const, error: "No active organization" };
  }
  if (!["instructor", "org_admin", "super_admin", "ta"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can upload node files." };
  }

  const parsed = uploadSchema.safeParse({
    programId: formData.get("programId"),
    nodeId: formData.get("nodeId"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Pick a file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false as const, error: "File is over 50 MB." };
  }
  const safeName = file.name;
  if (safeName.includes("..") || safeName.length > 255) {
    return { ok: false as const, error: "Unsafe filename." };
  }
  const lower = safeName.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
    return { ok: false as const, error: "Unsupported file type. Use PDF, PNG, JPG, or SVG." };
  }
  // Sniff PDF magic bytes if extension is .pdf to refuse spoofs.
  if (lower.endsWith(".pdf")) {
    const sniff = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isPdf = sniff[0] === 0x25 && sniff[1] === 0x50 && sniff[2] === 0x44 && sniff[3] === 0x46;
    if (!isPdf) return { ok: false as const, error: "File extension is .pdf but content isn't a PDF." };
  }

  const admin = createServiceRoleClient();
  const objectKey = `${session.activeOrganizationId}/${parsed.data.programId}/${parsed.data.nodeId}/${Date.now()}-${safeName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from(NODE_FILES_BUCKET)
    .upload(objectKey, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return { ok: false as const, error: uploadErr.message };

  // Update the node's config jsonb in-place (merge).
  const { data: existing } = await admin
    .from("path_nodes")
    .select("config, type")
    .eq("id", parsed.data.nodeId)
    .single();

  const prevConfig = (existing?.config as Record<string, unknown>) ?? {};
  const nextConfig = { ...prevConfig, storage_path: objectKey, filename: safeName, bytes: file.size };
  await admin.from("path_nodes").update({ config: nextConfig }).eq("id", parsed.data.nodeId);

  // Signed URL so the inspector can preview immediately.
  const { data: signed } = await admin.storage
    .from(NODE_FILES_BUCKET)
    .createSignedUrl(objectKey, 3600);

  revalidatePath(`/programs/${parsed.data.programId}/builder`);

  return {
    ok: true as const,
    storagePath: objectKey,
    filename: safeName,
    bytes: file.size,
    signedUrl: signed?.signedUrl ?? null,
  };
}

/**
 * Generate a fresh signed URL for an existing node file. Lets the inspector
 * keep showing previews after the original 1-hour signed URL expires.
 */
export async function getNodeFileSignedUrl(storagePath: string): Promise<string | null> {
  const session = await getActiveRole();
  if (!session) return null;
  const admin = createServiceRoleClient();
  const { data } = await admin.storage.from(NODE_FILES_BUCKET).createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

/**
 * Remove a node file (storage + clear from node.config).
 */
export async function deleteNodeFile(programId: string, nodeId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const admin = createServiceRoleClient();
  const { data: node } = await admin
    .from("path_nodes")
    .select("config")
    .eq("id", nodeId)
    .single();
  const cfg = (node?.config as { storage_path?: string }) ?? {};
  if (cfg.storage_path) {
    await admin.storage.from(NODE_FILES_BUCKET).remove([cfg.storage_path]);
  }
  const cleared = { ...cfg };
  delete cleared.storage_path;
  delete (cleared as Record<string, unknown>).filename;
  delete (cleared as Record<string, unknown>).bytes;
  await admin.from("path_nodes").update({ config: cleared }).eq("id", nodeId);
  revalidatePath(`/programs/${programId}/builder`);
  return { ok: true as const };
}

/**
 * Upsert the `certificates` row that backs a CERT-type path node. The cert
 * node's config stores `{ certificate_id }` pointing to this row.
 */
const certSchema = z.object({
  programId: z.string().uuid(),
  nodeId: z.string().uuid(),
  title: z.string().min(2),
  requiredNodeIds: z.array(z.string().uuid()).default([]),
  minGradePercentage: z.coerce.number().min(0).max(100).default(80),
  requiresInstructorApproval: z.coerce.boolean().default(false),
  templateId: z.string().uuid().optional().nullable(),
});

export async function upsertCertForNode(input: z.infer<typeof certSchema>) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const parsed = certSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const admin = createServiceRoleClient();
  const { data: node } = await admin
    .from("path_nodes")
    .select("id, type, config, program_id")
    .eq("id", parsed.data.nodeId)
    .single();
  if (!node || node.type !== "cert") {
    return { ok: false as const, error: "Node is not a certificate node" };
  }
  if (node.program_id !== parsed.data.programId) {
    return { ok: false as const, error: "Node belongs to a different Chatrail" };
  }

  // Ensure a default template exists for this org, create one if not.
  let templateId = parsed.data.templateId ?? null;
  if (!templateId) {
    const { data: existingTpl } = await admin
      .from("certificate_templates")
      .select("id")
      .eq("organization_id", session.activeOrganizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingTpl) {
      templateId = existingTpl.id;
    } else {
      const { data: newTpl } = await admin
        .from("certificate_templates")
        .insert({
          organization_id: session.activeOrganizationId,
          name: "Default brutalist template",
          slug: "brutalist-default",
        })
        .select("id")
        .single();
      templateId = newTpl?.id ?? null;
    }
  }
  if (!templateId) {
    return { ok: false as const, error: "Could not resolve a certificate template" };
  }

  const existingCertId = (node.config as { certificate_id?: string })?.certificate_id ?? null;

  if (existingCertId) {
    const { error } = await admin
      .from("certificates")
      .update({
        title: parsed.data.title,
        required_node_ids: parsed.data.requiredNodeIds,
        min_grade_percentage: parsed.data.minGradePercentage,
        requires_instructor_approval: parsed.data.requiresInstructorApproval,
        template_id: templateId,
      })
      .eq("id", existingCertId);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { data: newCert, error } = await admin
      .from("certificates")
      .insert({
        program_id: parsed.data.programId,
        node_id: parsed.data.nodeId,
        title: parsed.data.title,
        required_node_ids: parsed.data.requiredNodeIds,
        min_grade_percentage: parsed.data.minGradePercentage,
        requires_instructor_approval: parsed.data.requiresInstructorApproval,
        template_id: templateId,
      })
      .select("id")
      .single();
    if (error || !newCert) return { ok: false as const, error: error?.message ?? "Failed" };
    // Link the cert id back into the node config.
    const newConfig = { ...((node.config as Record<string, unknown>) ?? {}), certificate_id: newCert.id };
    await admin.from("path_nodes").update({ config: newConfig }).eq("id", parsed.data.nodeId);
  }

  revalidatePath(`/programs/${parsed.data.programId}/builder`);
  return { ok: true as const };
}
