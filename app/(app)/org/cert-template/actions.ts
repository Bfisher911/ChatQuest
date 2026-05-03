"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

const updateSchema = z.object({
  templateId: z.string().uuid(),
  organizationId: z.string().uuid(),
  signerName: z.string().optional().nullable(),
  signerTitle: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  paperSize: z.enum(["Letter-landscape", "A4-landscape"]).default("Letter-landscape"),
  orgLogoUrl: z.string().url().nullable().optional(),
  signatureImageUrl: z.string().url().nullable().optional(),
});

export async function updateCertTemplate(input: z.infer<typeof updateSchema>) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can edit cert templates." };
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase
    .from("certificate_templates")
    .update({
      signer_name: parsed.data.signerName ?? null,
      signer_title: parsed.data.signerTitle ?? null,
      body_text: parsed.data.bodyText ?? null,
      paper_size: parsed.data.paperSize,
      org_logo_url: parsed.data.orgLogoUrl ?? null,
      signature_image_url: parsed.data.signatureImageUrl ?? null,
    })
    .eq("id", parsed.data.templateId)
    .eq("organization_id", parsed.data.organizationId);
  if (error) return { ok: false as const, error: error.message };

  // Mirror the org logo on the org row too, so other surfaces (header, etc.)
  // can pick it up later.
  if (parsed.data.orgLogoUrl) {
    const admin = createServiceRoleClient();
    await admin
      .from("organizations")
      .update({ logo_url: parsed.data.orgLogoUrl })
      .eq("id", parsed.data.organizationId);
  }

  revalidatePath("/org/cert-template");
  return { ok: true as const };
}

const uploadSchema = z.object({
  organizationId: z.string().uuid(),
  kind: z.enum(["logo", "signature"]),
});

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

export async function uploadCertAsset(formData: FormData) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const parsed = uploadSchema.safeParse({
    organizationId: formData.get("organizationId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.organizationId !== session.activeOrganizationId) {
    return { ok: false as const, error: "Wrong organization." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Pick an image first." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false as const, error: "Image is over 2 MB." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false as const, error: "PNG / JPG / SVG only." };
  }

  const admin = createServiceRoleClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const objectKey = `${parsed.data.organizationId}/${parsed.data.kind}-${Date.now()}-${safe}`;
  const { error: upErr } = await admin.storage
    .from("org-logos")
    .upload(objectKey, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return { ok: false as const, error: upErr.message };

  // org-logos bucket is public; build a public URL.
  const { data: pub } = admin.storage.from("org-logos").getPublicUrl(objectKey);
  return { ok: true as const, url: pub.publicUrl };
}
