"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Eyebrow, Frame, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import {
  previewCsvImport,
  commitCsvImport,
  type CsvPreviewRow,
} from "./actions";

const SAMPLE = `email,name,role
ada@example.edu,Ada Okonkwo,learner
marcus@example.edu,Marcus Chen,learner
priya@example.edu,Priya Raman,ta`;

export function CsvImport({ programId }: { programId: string }) {
  const router = useRouter();
  const [csv, setCsv] = React.useState("");
  const [step, setStep] = React.useState<"input" | "preview" | "done">("input");
  const [pending, setPending] = React.useState(false);
  const [rows, setRows] = React.useState<CsvPreviewRow[]>([]);
  const [duplicates, setDuplicates] = React.useState(0);
  const [result, setResult] = React.useState<{
    added: number;
    errors: number;
    errorsList: { email: string; reason: string }[];
  } | null>(null);

  async function preview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await previewCsvImport({ programId, csv });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.rows.length === 0) {
      toast.error("CSV had no parseable rows.");
      return;
    }
    setRows(res.rows);
    setDuplicates(res.duplicates);
    setStep("preview");
  }

  async function commit() {
    const valid = rows.filter((r) => r.status === "valid");
    if (valid.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }
    setPending(true);
    const res = await commitCsvImport({
      programId,
      rows: valid.map((r) => ({
        email: r.email,
        fullName: r.fullName,
        role: r.role,
      })),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setResult({ added: res.added, errors: res.errors, errorsList: res.errorsList });
    setStep("done");
    if (res.added > 0) toast.success(`Added ${res.added} learner${res.added === 1 ? "" : "s"}.`);
    if (res.errors > 0) toast.error(`${res.errors} failed — see details.`);
    router.refresh();
  }

  function reset() {
    setCsv("");
    setStep("input");
    setRows([]);
    setResult(null);
    setDuplicates(0);
  }

  if (step === "done" && result) {
    return (
      <Frame style={{ padding: 16 }}>
        <Eyebrow>IMPORT COMPLETE</Eyebrow>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Chip>ADDED · {result.added}</Chip>
          {result.errors > 0 ? <Chip ghost>FAILED · {result.errors}</Chip> : null}
        </div>
        {result.errorsList.length > 0 ? (
          <div style={{ marginTop: 12, maxHeight: 220, overflowY: "auto" }}>
            <table className="cq-table" style={{ minWidth: "auto" }}>
              <thead>
                <tr>
                  <th>EMAIL</th>
                  <th>REASON</th>
                </tr>
              </thead>
              <tbody>
                {result.errorsList.map((e, i) => (
                  <tr key={i}>
                    <td>{e.email}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <Btn sm onClick={reset}>
            <Icon name="plus" /> IMPORT MORE
          </Btn>
        </div>
      </Frame>
    );
  }

  if (step === "preview") {
    const valid = rows.filter((r) => r.status === "valid").length;
    const invalid = rows.length - valid - duplicates;
    return (
      <div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Chip>{valid} VALID</Chip>
          {duplicates > 0 ? <Chip ghost>{duplicates} DUPLICATE</Chip> : null}
          {invalid > 0 ? <Chip ghost>{invalid} INVALID</Chip> : null}
        </div>
        <Frame style={{ padding: 0, maxHeight: 360, overflowY: "auto" }}>
          <table className="cq-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>EMAIL</th>
                <th>NAME</th>
                <th className="num">ROLE</th>
                <th className="num">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.index}
                  style={{
                    opacity: r.status === "valid" ? 1 : 0.7,
                    background: r.status === "valid" ? "var(--paper)" : "var(--soft)",
                  }}
                >
                  <td className="num cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                    {String(r.index + 1).padStart(2, "0")}
                  </td>
                  <td>{r.email || <em style={{ color: "var(--muted)" }}>(empty)</em>}</td>
                  <td>
                    {r.fullName ?? (
                      <span className="cq-mono" style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td className="num">
                    <Chip ghost>{r.role.toUpperCase()}</Chip>
                  </td>
                  <td className="num">
                    {r.status === "valid" ? (
                      <Chip>VALID</Chip>
                    ) : (
                      <span title={r.reason}>
                        <Chip ghost>
                          {r.status === "duplicate"
                            ? "DUP"
                            : r.status === "invalid_email"
                            ? "BAD EMAIL"
                            : "MISSING"}
                        </Chip>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Frame>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
          Only rows marked <strong>VALID</strong> will be invited. Duplicates and invalid rows are
          skipped automatically.
        </p>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Btn onClick={commit} disabled={pending || valid === 0}>
            {pending ? "IMPORTING…" : `IMPORT ${valid} LEARNER${valid === 1 ? "" : "S"}`}{" "}
            <Icon name="check" />
          </Btn>
          <Btn ghost onClick={reset} disabled={pending}>
            <Icon name="x" /> CANCEL
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={preview} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: 0 }}>
        Header optional. Columns: <code>email</code>, <code>name</code> (optional),{" "}
        <code>role</code> (optional — defaults to <code>learner</code>; can be{" "}
        <code>learner</code>, <code>ta</code>, or <code>instructor</code>).
      </p>
      <textarea
        name="csv"
        className="cq-textarea"
        placeholder={SAMPLE}
        rows={8}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        required
      />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Btn type="submit" ghost disabled={pending}>
          {pending ? "PARSING…" : "PREVIEW IMPORT"} <Icon name="arrow" />
        </Btn>
        <Btn type="button" ghost sm onClick={() => setCsv(SAMPLE)} disabled={pending}>
          <Icon name="file" /> LOAD SAMPLE
        </Btn>
      </div>
    </form>
  );
}
