// Stream a certificate PDF for an award. Public if you have the verification
// code; otherwise the caller must be the learner, an instructor of the
// program, the org admin, or super admin.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { renderCertificatePdf } from "@/lib/certificates/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { awardId: string } },
) {
  const url = new URL(req.url);
  const code = url.searchParams.get("v");

  const admin = createServiceRoleClient();
  const { data: award, error } = await admin
    .from("certificate_awards")
    .select("id, learner_id, organization_id, verification_code, awarded_at, certificate:certificates(title, program:programs(title), template:certificate_templates(signer_name, signer_title, body_text, signature_image_url, org_logo_url, paper_size)), learner:users(full_name, display_name, email), organization:organizations(name, logo_url)")
    .eq("id", params.awardId)
    .maybeSingle();
  if (error || !award) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authorize: either the verification code matches OR the user has access.
  if (!code || code !== award.verification_code) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.id !== award.learner_id) {
      // Re-check via RLS-aware client.
      const { data: probe } = await supabase
        .from("certificate_awards")
        .select("id")
        .eq("id", params.awardId)
        .maybeSingle();
      if (!probe) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  type CertJoin = {
    title: string;
    program: { title: string }[] | { title: string } | null;
    template:
      | {
          signer_name: string | null;
          signer_title: string | null;
          body_text: string | null;
          signature_image_url: string | null;
          org_logo_url: string | null;
          paper_size: string | null;
        }[]
      | {
          signer_name: string | null;
          signer_title: string | null;
          body_text: string | null;
          signature_image_url: string | null;
          org_logo_url: string | null;
          paper_size: string | null;
        }
      | null;
  };
  const cert = (award.certificate as unknown) as CertJoin | null;
  const learner = (award.learner as unknown) as
    | { full_name: string | null; display_name: string | null; email: string }[]
    | { full_name: string | null; display_name: string | null; email: string }
    | null;
  const org = (award.organization as unknown) as
    | { name: string; logo_url: string | null }[]
    | { name: string; logo_url: string | null }
    | null;

  const pickOne = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const certPick = pickOne(cert);
  const programPick = pickOne(certPick?.program ?? null);
  let templatePick = pickOne(certPick?.template ?? null);
  const learnerPick = pickOne(learner);
  const orgPick = pickOne(org);

  // Fall back to the org's "Default Template" if the certificate row didn't
  // pick a custom one.
  if (!templatePick) {
    const { data: fallback } = await admin
      .from("certificate_templates")
      .select("signer_name, signer_title, body_text, signature_image_url, org_logo_url, paper_size")
      .eq("organization_id", award.organization_id)
      .eq("name", "Default Template")
      .maybeSingle();
    if (fallback) templatePick = fallback;
  }

  const paper =
    templatePick?.paper_size === "A4-landscape"
      ? "A4-landscape"
      : "Letter-landscape";

  const pdfBuf = await renderCertificatePdf({
    certificateTitle: certPick?.title ?? "Certificate of Completion",
    programTitle: programPick?.title ?? "Program",
    organizationName: orgPick?.name ?? "Chatrail",
    recipientName:
      learnerPick?.full_name ?? learnerPick?.display_name ?? learnerPick?.email ?? "Learner",
    signerName: templatePick?.signer_name ?? null,
    signerTitle: templatePick?.signer_title ?? null,
    awardedAt: new Date(award.awarded_at),
    verificationCode: award.verification_code,
    verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify-cert/${award.verification_code}`,
    bodyText: templatePick?.body_text ?? null,
    orgLogoUrl: templatePick?.org_logo_url ?? orgPick?.logo_url ?? null,
    signatureImageUrl: templatePick?.signature_image_url ?? null,
    paperSize: paper,
  });

  // Cast Buffer → Uint8Array so it satisfies BodyInit.
  return new NextResponse(new Uint8Array(pdfBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(certPick?.title ?? "certificate").replace(/[^a-zA-Z0-9-]/g, "_")}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
