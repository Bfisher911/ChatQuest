import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Btn, Icon, Chip } from "@/components/brutalist";
import { NewProgramForm } from "./new-program-form";

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) redirect("/dashboard");
  return (
    <div className="cq-page" style={{ maxWidth: 720 }}>
      <Eyebrow>NEW CHATRAIL</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        CREATE A CHATRAIL.
      </h1>

      {/* AI generator entry — surfaces the one-prompt flow without forcing
          new creators to discover the route. */}
      <div
        style={{
          padding: 18,
          marginBottom: 28,
          border: "var(--hair) solid var(--ink)",
          background: "var(--soft)",
        }}
      >
        <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <Chip>AI · BETA</Chip>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>
            Skip the blank page — describe it, get a draft.
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
          One paragraph in, a 3–7 node Chatrail with pre-written system
          prompts and learner instructions out. Lands in DRAFT so you can edit
          every bot before publishing.
        </p>
        <Btn sm asChild>
          <Link href="/programs/generate">
            GENERATE WITH AI <Icon name="arrow" />
          </Link>
        </Btn>
      </div>

      <Eyebrow>OR START BLANK</Eyebrow>
      <div style={{ marginTop: 12 }}>
        <NewProgramForm />
      </div>
    </div>
  );
}
