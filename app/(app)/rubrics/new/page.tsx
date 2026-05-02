import * as React from "react";
import { redirect } from "next/navigation";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow } from "@/components/brutalist";
import { NewRubricForm } from "./new-rubric-form";

export const dynamic = "force-dynamic";

export default async function NewRubricPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    redirect("/dashboard");
  }
  return (
    <div className="cq-page" style={{ maxWidth: 720 }}>
      <Eyebrow>NEW RUBRIC</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        BUILD A RUBRIC.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        Start with a name + description, then add weighted criteria on the next step.
      </p>
      <NewRubricForm />
    </div>
  );
}
