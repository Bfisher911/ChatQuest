"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { uploadKbFile } from "../../actions";

export function KbUploader({ collectionId, programId }: { collectionId: string; programId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("collectionId", collectionId);
    fd.set("programId", programId);
    const res = await uploadKbFile(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Upload failed");
      return;
    }
    setSuccess(`Indexed ${res.chunks ?? 0} chunks.`);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error ? <div className="cq-form-error">{error}</div> : null}
      {success ? <div className="cq-form-success">{success}</div> : null}
      <div className="cq-field">
        <label htmlFor="file">PDF / TXT / MD / CSV</label>
        <input
          ref={inputRef}
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown,text/csv"
          className="cq-input"
        />
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "INDEXING…" : "UPLOAD + INDEX"} <Icon name="upload" />
        </Btn>
      </div>
    </form>
  );
}
