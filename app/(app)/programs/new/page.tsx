import * as React from "react";
import { redirect } from "next/navigation";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow } from "@/components/brutalist";
import { NewProgramForm } from "./new-program-form";

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) redirect("/dashboard");
  return (
    <div className="cq-page" style={{ maxWidth: 720 }}>
      <Eyebrow>NEW PROGRAM</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        CREATE A PROGRAM.
      </h1>
      <NewProgramForm />
    </div>
  );
}
