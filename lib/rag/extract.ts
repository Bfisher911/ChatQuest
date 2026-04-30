// Extract plain text from uploaded files. Supports PDF / TXT / MD / CSV.
// DOCX support is stubbed for Phase 1 — add `mammoth` in Phase 2.

import pdfParse from "pdf-parse";

export interface ExtractedDoc {
  text: string;
  pageCount?: number;
}

export async function extractDocument(
  filename: string,
  mimeType: string | undefined,
  buffer: Buffer,
): Promise<ExtractedDoc> {
  const lower = filename.toLowerCase();
  const mt = (mimeType ?? "").toLowerCase();
  if (mt === "application/pdf" || lower.endsWith(".pdf")) {
    const r = await pdfParse(buffer);
    return { text: r.text, pageCount: r.numpages };
  }
  if (
    mt === "text/plain" ||
    mt === "text/markdown" ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown")
  ) {
    return { text: buffer.toString("utf8") };
  }
  if (mt === "text/csv" || lower.endsWith(".csv")) {
    return { text: buffer.toString("utf8") };
  }
  if (
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    // Lazy-import so the server bundle doesn't pay the cost on every cold start.
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value };
  }
  // Unknown type → try utf8.
  try {
    return { text: buffer.toString("utf8") };
  } catch {
    throw new Error(`Unsupported file type: ${mimeType ?? filename}`);
  }
}
