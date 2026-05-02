import * as React from "react";
import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { Eyebrow, Btn } from "@/components/brutalist";

export const metadata = {
  title: "Changelog — Chatrail docs",
  description: "What's shipped, by date.",
};
export const revalidate = 3600;

export default async function ChangelogPage() {
  const file = path.join(process.cwd(), "CHANGELOG.md");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    raw = "## Changelog unavailable\n\nNo `CHANGELOG.md` was found in the build.";
  }
  const html = renderMarkdown(raw);

  return (
    <article
      className="cq-page"
      style={{ maxWidth: 820, fontFamily: "var(--font-sans)", lineHeight: 1.55 }}
    >
      <Eyebrow>DOCS · CHANGELOG</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        SHIPPED.
      </h1>
      <div
        className="cq-changelog"
        style={{ fontSize: 15 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div style={{ marginTop: 32 }}>
        <Btn ghost asChild>
          <Link href="/docs">BACK TO DOCS</Link>
        </Btn>
      </div>
    </article>
  );
}

/**
 * Tiny safe markdown renderer (headings + bullets + bold + italic + code).
 * Avoids pulling in a 100 KB+ markdown lib for a one-page changelog.
 */
function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1 class="cq-title-l" style="margin:24px 0 12px;font-size:32px;text-transform:uppercase;">${esc(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2 class="cq-title-m" style="margin:24px 0 8px;">${esc(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3 style="font-family:var(--font-sans);font-weight:800;font-size:18px;text-transform:uppercase;margin:18px 0 6px;">${esc(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul style='padding-left:20px;line-height:1.6;'>"); inList = true; }
      out.push(`<li>${inlineMd(esc(line.slice(2)))}</li>`);
      continue;
    }
    if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inlineMd(esc(line))}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inlineMd(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);background:var(--soft);padding:1px 4px;">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}
