"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Chip, IconBtn, Icon } from "@/components/brutalist";
import { deleteKbFile, reindexKbFile } from "../../actions";

interface KbFile {
  id: string;
  filename: string;
  status: string;
  status_message: string | null;
  pages: number | null;
  bytes: number | null;
  indexed_at: string | null;
  uploaded_at: string;
}

function fmtBytes(b: number | null) {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function KbFileList({ programId, files }: { programId: string; files: KbFile[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  if (files.length === 0) {
    return (
      <div className="cq-frame" style={{ padding: 28, textAlign: "center" }}>
        <div className="cq-mono" style={{ fontSize: 13, color: "var(--muted)" }}>NO FILES YET</div>
      </div>
    );
  }

  return (
    <div className="cq-table cq-frame--thin" style={{ borderCollapse: "collapse" }}>
      <table className="cq-table" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th>FILE</th>
            <th className="num">STATUS</th>
            <th className="num">PAGES</th>
            <th className="num">SIZE</th>
            <th className="num">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id}>
              <td>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{f.filename}</div>
                {f.status_message ? (
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.status_message}</div>
                ) : null}
              </td>
              <td className="num">
                <Chip ghost={f.status !== "indexed"}>{f.status.toUpperCase()}</Chip>
              </td>
              <td className="num">{f.pages ?? "—"}</td>
              <td className="num">{fmtBytes(f.bytes)}</td>
              <td className="num">
                <div className="row" style={{ gap: 6, justifyContent: "center" }}>
                  <IconBtn
                    title="Re-index"
                    aria-label="Re-index"
                    disabled={busyId === f.id}
                    onClick={async () => {
                      setBusyId(f.id);
                      await reindexKbFile(f.id);
                      setBusyId(null);
                      router.refresh();
                    }}
                  >
                    <Icon name="settings" />
                  </IconBtn>
                  <IconBtn
                    title="Delete"
                    aria-label="Delete"
                    disabled={busyId === f.id}
                    onClick={async () => {
                      if (!confirm(`Delete ${f.filename}?`)) return;
                      setBusyId(f.id);
                      await deleteKbFile(f.id, programId);
                      setBusyId(null);
                      router.refresh();
                    }}
                  >
                    <Icon name="trash" />
                  </IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
