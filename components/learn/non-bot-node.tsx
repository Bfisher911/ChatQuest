"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn, Chip, Eyebrow, Icon } from "@/components/brutalist";
import { markNodeComplete } from "@/lib/path/actions";
import { toast } from "sonner";

interface BaseNodeProps {
  programId: string;
  nodeId: string;
  title: string;
  alreadyComplete: boolean;
}

export function ContentNodeView({
  programId,
  nodeId,
  title,
  alreadyComplete,
  bodyHtml,
  readingMinutes,
}: BaseNodeProps & { bodyHtml: string; readingMinutes?: number | null }) {
  return (
    <NodeShell programId={programId} nodeId={nodeId} title={title} type="CONTENT" alreadyComplete={alreadyComplete}>
      {readingMinutes ? (
        <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          ~ {readingMinutes} MIN READ
        </div>
      ) : null}
      <article
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          lineHeight: 1.6,
          maxWidth: 700,
        }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </NodeShell>
  );
}

export function PdfNodeView({
  programId,
  nodeId,
  title,
  alreadyComplete,
  signedUrl,
  filename,
}: BaseNodeProps & { signedUrl: string | null; filename: string }) {
  return (
    <NodeShell programId={programId} nodeId={nodeId} title={title} type="PDF" alreadyComplete={alreadyComplete}>
      <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        {filename}
      </div>
      {signedUrl ? (
        <object
          data={signedUrl}
          type="application/pdf"
          style={{ width: "100%", height: 600, border: "var(--hair) solid var(--ink)" }}
        >
          <div className="cq-frame" style={{ padding: 24 }}>
            <p style={{ fontFamily: "var(--font-mono)", marginBottom: 12 }}>
              Your browser can't preview this PDF inline.
            </p>
            <Btn asChild>
              <a href={signedUrl} target="_blank" rel="noreferrer">
                <Icon name="download" /> DOWNLOAD PDF
              </a>
            </Btn>
          </div>
        </object>
      ) : (
        <div className="cq-form-error">PDF not available</div>
      )}
    </NodeShell>
  );
}

export function LinkNodeView({
  programId,
  nodeId,
  title,
  alreadyComplete,
  url,
  description,
}: BaseNodeProps & { url: string; description?: string }) {
  return (
    <NodeShell programId={programId} nodeId={nodeId} title={title} type="EXTERNAL" alreadyComplete={alreadyComplete}>
      {description ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, marginBottom: 16, color: "var(--muted)" }}>
          {description}
        </p>
      ) : null}
      <div className="cq-frame" style={{ padding: 20 }}>
        <Eyebrow>EXTERNAL RESOURCE</Eyebrow>
        <div className="cq-mono" style={{ fontSize: 14, marginTop: 8, marginBottom: 12, wordBreak: "break-all" }}>
          {url}
        </div>
        <Btn asChild>
          <a href={url} target="_blank" rel="noreferrer">
            OPEN <Icon name="arrow" />
          </a>
        </Btn>
      </div>
    </NodeShell>
  );
}

export function MilestoneNodeView({
  programId,
  nodeId,
  title,
  alreadyComplete,
  requiredCount,
  metCount,
}: BaseNodeProps & { requiredCount: number; metCount: number }) {
  const ready = metCount >= requiredCount;
  return (
    <NodeShell programId={programId} nodeId={nodeId} title={title} type="MILESTONE" alreadyComplete={alreadyComplete}>
      <Eyebrow>CHECKPOINT</Eyebrow>
      <div className="cq-title-l" style={{ fontSize: 48, marginTop: 12 }}>
        {metCount} / {requiredCount}
      </div>
      <p style={{ fontFamily: "var(--font-mono)", marginTop: 12, color: "var(--muted)" }}>
        {ready
          ? "All required nodes complete. Click below to mark this milestone."
          : `Complete ${requiredCount - metCount} more required node${requiredCount - metCount === 1 ? "" : "s"} to unlock.`}
      </p>
    </NodeShell>
  );
}

export function CertNodeView({
  programId,
  nodeId,
  title,
  alreadyComplete,
  hasAward,
  pdfUrl,
  verificationCode,
}: BaseNodeProps & {
  hasAward: boolean;
  pdfUrl: string | null;
  verificationCode: string | null;
}) {
  return (
    <NodeShell
      programId={programId}
      nodeId={nodeId}
      title={title}
      type="CERTIFICATE"
      alreadyComplete={alreadyComplete}
      hideMarkComplete={!hasAward}
    >
      {hasAward ? (
        <>
          <Eyebrow>YOU EARNED THIS CERTIFICATE</Eyebrow>
          <div className="cq-title-l" style={{ fontSize: 36, marginTop: 12 }}>
            {title.toUpperCase()}
          </div>
          {verificationCode ? (
            <div className="cq-mono" style={{ marginTop: 12, fontSize: 14 }}>
              VERIFICATION CODE: <strong>{verificationCode}</strong>
            </div>
          ) : null}
          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            {pdfUrl ? (
              <Btn asChild>
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <Icon name="download" /> DOWNLOAD PDF
                </a>
              </Btn>
            ) : null}
            {verificationCode ? (
              <Btn ghost asChild>
                <Link href={`/verify-cert/${verificationCode}`}>VERIFY</Link>
              </Btn>
            ) : null}
          </div>
        </>
      ) : (
        <div className="cq-frame" style={{ padding: 24 }}>
          <Eyebrow>NOT YET EARNED</Eyebrow>
          <p style={{ fontFamily: "var(--font-mono)", marginTop: 8 }}>
            Complete the program's required nodes (and meet the minimum score)
            to unlock this certificate.
          </p>
        </div>
      )}
    </NodeShell>
  );
}

function NodeShell({
  programId,
  nodeId,
  title,
  type,
  alreadyComplete,
  children,
  hideMarkComplete,
}: {
  programId: string;
  nodeId: string;
  title: string;
  type: string;
  alreadyComplete: boolean;
  children: React.ReactNode;
  hideMarkComplete?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(alreadyComplete);

  async function complete() {
    setPending(true);
    const res = await markNodeComplete(programId, nodeId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Marked complete.");
    setDone(true);
    router.refresh();
  }

  return (
    <div className="cq-page" style={{ maxWidth: 900 }}>
      <div className="row" style={{ marginBottom: 16, alignItems: "center", gap: 12 }}>
        <Btn sm ghost asChild>
          <Link href={`/learn/${programId}`}>
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> JOURNEY
          </Link>
        </Btn>
        <Chip>{type}</Chip>
        {done && <Chip ghost>DONE</Chip>}
      </div>
      <h1 className="cq-title-l" style={{ marginBottom: 24 }}>
        {title.toUpperCase()}
      </h1>
      {children}
      {!hideMarkComplete && !done ? (
        <div style={{ marginTop: 28 }}>
          <Btn onClick={complete} disabled={pending}>
            {pending ? "MARKING…" : "MARK COMPLETE"} <Icon name="check" />
          </Btn>
        </div>
      ) : null}
    </div>
  );
}
