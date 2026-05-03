"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn, Chip, Icon, IconBtn } from "@/components/brutalist";
import { toast } from "sonner";
import { reindexKbFile, deleteKbFile } from "@/app/(app)/programs/actions";
import { getKbFileSignedUrl } from "./actions";

interface KbFile {
  id: string;
  filename: string;
  status: string;
  statusMessage: string | null;
  pages: number | null;
  bytes: number | null;
  uploadedAt: string;
  indexedAt: string | null;
  collectionName: string;
  programId: string | null;
  programTitle: string;
}

function fmtBytes(b: number | null) {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

const STATUS_TONE: Record<string, { ghost: boolean; label: string }> = {
  indexed: { ghost: false, label: "INDEXED" },
  processing: { ghost: true, label: "PROCESSING" },
  pending: { ghost: true, label: "PENDING" },
  failed: { ghost: true, label: "FAILED" },
};

export function KbFileRow({ file }: { file: KbFile }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const tone = STATUS_TONE[file.status] ?? { ghost: true, label: file.status.toUpperCase() };

  async function reindex() {
    setBusy(true);
    const res = await reindexKbFile(file.id);
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Reindex failed");
    else {
      toast.success("Reindexed.");
      router.refresh();
    }
  }

  async function remove() {
    if (!file.programId) {
      toast.error("Couldn't determine parent Chatrail.");
      return;
    }
    if (!confirm(`Delete ${file.filename}? This removes the file + its embeddings.`)) return;
    setBusy(true);
    const res = await deleteKbFile(file.id, file.programId);
    setBusy(false);
    if (!res.ok) toast.error("Delete failed");
    else {
      toast.success("Deleted.");
      router.refresh();
    }
  }

  async function download() {
    setBusy(true);
    const res = await getKbFileSignedUrl(file.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener");
  }

  return (
    <tr>
      <td>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, wordBreak: "break-word" }}>
          {file.filename}
        </div>
        {file.statusMessage ? (
          <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {file.statusMessage}
          </div>
        ) : null}
      </td>
      <td>
        {file.programId ? (
          <Link
            href={`/programs/${file.programId}/kb`}
            style={{ textDecoration: "underline" }}
          >
            {file.programTitle}
          </Link>
        ) : (
          file.programTitle
        )}
        <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          {file.collectionName}
        </div>
      </td>
      <td className="num">
        <Chip ghost={tone.ghost}>{tone.label}</Chip>
      </td>
      <td className="num">{file.pages ?? "—"}</td>
      <td className="num">{fmtBytes(file.bytes)}</td>
      <td className="num">{new Date(file.uploadedAt).toISOString().slice(0, 10)}</td>
      <td className="num">
        <div className="row" style={{ gap: 4, justifyContent: "center" }}>
          <IconBtn aria-label="Download" disabled={busy} onClick={download} title="Download">
            <Icon name="download" size={12} />
          </IconBtn>
          <IconBtn aria-label="Re-index" disabled={busy} onClick={reindex} title="Re-index">
            <Icon name="settings" size={12} />
          </IconBtn>
          <IconBtn aria-label="Delete" disabled={busy} onClick={remove} title="Delete">
            <Icon name="trash" size={12} />
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}
