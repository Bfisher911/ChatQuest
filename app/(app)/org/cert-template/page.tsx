import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Frame, Btn, Icon, Chip } from "@/components/brutalist";
import { CertTemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

export default async function CertTemplatePage() {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) redirect("/dashboard");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    redirect("/dashboard");
  }
  const supabase = createClient();
  const admin = createServiceRoleClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, logo_url")
    .eq("id", session.activeOrganizationId)
    .single();

  // Find or create the default template for this org.
  let { data: template } = await supabase
    .from("certificate_templates")
    .select("id, name, slug, body_text, signer_name, signer_title, signature_image_url, org_logo_url, paper_size")
    .eq("organization_id", session.activeOrganizationId)
    .eq("name", "Default Template")
    .maybeSingle();
  if (!template) {
    const { data: created } = await admin
      .from("certificate_templates")
      .insert({
        organization_id: session.activeOrganizationId,
        name: "Default Template",
        slug: "brutalist-default",
        paper_size: "Letter-landscape",
      })
      .select("id, name, slug, body_text, signer_name, signer_title, signature_image_url, org_logo_url, paper_size")
      .single();
    template = created;
  }

  // Stats — how many awards have used this template's flow.
  const { count: awardCount } = await admin
    .from("certificate_awards")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", session.activeOrganizationId);

  return (
    <div className="cq-page" style={{ maxWidth: 920 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Btn sm ghost asChild>
          <Link href="/dashboard">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> DASHBOARD
          </Link>
        </Btn>
        <Chip>{awardCount ?? 0} CERTS ISSUED</Chip>
      </div>
      <Eyebrow>CERTIFICATE TEMPLATE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        {(org?.name ?? "ORG").toUpperCase()} · CERT
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        This is the default cert template every Chatrail in this org uses unless overridden.
        Update the signer block + a body line + your org logo so awards look like yours, not ours.
      </p>

      {template ? (
        <Frame style={{ padding: 24 }}>
          <CertTemplateForm
            organizationId={session.activeOrganizationId}
            template={{
              id: template.id,
              signerName: template.signer_name ?? "",
              signerTitle: template.signer_title ?? "",
              bodyText: template.body_text ?? "",
              signatureImageUrl: template.signature_image_url ?? null,
              orgLogoUrl: template.org_logo_url ?? null,
              paperSize: template.paper_size ?? "Letter-landscape",
            }}
            orgLogoUrl={org?.logo_url ?? null}
          />
        </Frame>
      ) : (
        <Frame style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)" }}>Couldn&apos;t load template.</p>
        </Frame>
      )}

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <Btn sm ghost asChild>
          <Link href="/learn/certificates">
            <Icon name="award" /> SEE LEARNER CERT VIEW
          </Link>
        </Btn>
      </div>
    </div>
  );
}
