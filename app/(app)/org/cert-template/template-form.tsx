"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon, Eyebrow } from "@/components/brutalist";
import { toast } from "sonner";
import {
  updateCertTemplate,
  uploadCertAsset,
} from "./actions";

interface TemplateFormProps {
  organizationId: string;
  template: {
    id: string;
    signerName: string;
    signerTitle: string;
    bodyText: string;
    signatureImageUrl: string | null;
    orgLogoUrl: string | null;
    paperSize: string;
  };
  orgLogoUrl: string | null;
}

export function CertTemplateForm({ organizationId, template, orgLogoUrl }: TemplateFormProps) {
  const router = useRouter();
  const [signerName, setSignerName] = React.useState(template.signerName);
  const [signerTitle, setSignerTitle] = React.useState(template.signerTitle);
  const [bodyText, setBodyText] = React.useState(template.bodyText);
  const [paperSize, setPaperSize] = React.useState(template.paperSize);
  const [logoUrl, setLogoUrl] = React.useState(template.orgLogoUrl ?? orgLogoUrl);
  const [signatureUrl, setSignatureUrl] = React.useState(template.signatureImageUrl);
  const [pending, setPending] = React.useState(false);

  const logoRef = React.useRef<HTMLInputElement>(null);
  const signatureRef = React.useRef<HTMLInputElement>(null);

  async function save() {
    setPending(true);
    const res = await updateCertTemplate({
      templateId: template.id,
      organizationId,
      signerName,
      signerTitle,
      bodyText,
      paperSize: (paperSize === "A4-landscape" ? "A4-landscape" : "Letter-landscape") as "Letter-landscape" | "A4-landscape",
      orgLogoUrl: logoUrl,
      signatureImageUrl: signatureUrl,
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Saved.");
      router.refresh();
    }
  }

  async function uploadFile(kind: "logo" | "signature", file: File) {
    setPending(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    fd.set("organizationId", organizationId);
    const res = await uploadCertAsset(fd);
    setPending(false);
    if (!res.ok || !res.url) {
      toast.error(res.ok ? "Upload OK but no URL" : res.error);
      return;
    }
    if (kind === "logo") setLogoUrl(res.url);
    else setSignatureUrl(res.url);
    toast.success(`${kind === "logo" ? "Logo" : "Signature"} uploaded — click SAVE to apply.`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Eyebrow>SIGNER BLOCK</Eyebrow>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="signerName">Signer name</label>
          <input
            id="signerName"
            className="cq-input"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Dr. Kowalski"
          />
        </div>
        <div className="cq-field">
          <label htmlFor="signerTitle">Signer title</label>
          <input
            id="signerTitle"
            className="cq-input"
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            placeholder="Director of Learning"
          />
        </div>
      </div>

      <div className="cq-field">
        <label htmlFor="bodyText">Body text (1-2 sentences below the program line)</label>
        <textarea
          id="bodyText"
          className="cq-textarea"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Awarded for sustained engagement and demonstrated mastery."
        />
      </div>

      <Eyebrow>ASSETS</Eyebrow>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label>Org logo (PNG/JPG/SVG, ≤ 2 MB)</label>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Org logo"
              style={{ maxHeight: 80, border: "var(--hair) solid var(--ink)", padding: 6, marginBottom: 8 }}
            />
          ) : (
            <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
              No logo set — falls back to the CHAT|RAIL brand mark.
            </div>
          )}
          <input
            ref={logoRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void uploadFile("logo", f);
              if (logoRef.current) logoRef.current.value = "";
            }}
          />
          <Btn sm ghost type="button" onClick={() => logoRef.current?.click()} disabled={pending}>
            <Icon name="upload" /> {logoUrl ? "REPLACE LOGO" : "UPLOAD LOGO"}
          </Btn>
        </div>
        <div className="cq-field">
          <label>Signature image (transparent PNG, ≤ 2 MB)</label>
          {signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signatureUrl}
              alt="Signature"
              style={{ maxHeight: 80, border: "var(--hair) solid var(--ink)", padding: 6, marginBottom: 8 }}
            />
          ) : (
            <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
              No signature image — falls back to the typed signer name only.
            </div>
          )}
          <input
            ref={signatureRef}
            type="file"
            accept="image/png,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void uploadFile("signature", f);
              if (signatureRef.current) signatureRef.current.value = "";
            }}
          />
          <Btn sm ghost type="button" onClick={() => signatureRef.current?.click()} disabled={pending}>
            <Icon name="upload" /> {signatureUrl ? "REPLACE SIGNATURE" : "UPLOAD SIGNATURE"}
          </Btn>
        </div>
      </div>

      <div className="cq-field">
        <label htmlFor="paperSize">Paper size</label>
        <select
          id="paperSize"
          className="cq-select"
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value)}
          style={{ width: 240 }}
        >
          <option value="Letter-landscape">US Letter (landscape)</option>
          <option value="A4-landscape">A4 (landscape)</option>
        </select>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <Btn onClick={save} disabled={pending}>
          {pending ? "SAVING…" : "SAVE TEMPLATE"} <Icon name="check" />
        </Btn>
      </div>
    </div>
  );
}
