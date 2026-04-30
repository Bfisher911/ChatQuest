import * as React from "react";
import { Eyebrow, Frame } from "@/components/brutalist";
import { DeleteAccountForm } from "./delete-form";

export const dynamic = "force-dynamic";

export default function DeleteAccountPage() {
  return (
    <div className="cq-page" style={{ maxWidth: 720 }}>
      <Eyebrow>ACCOUNT · DELETE</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
        DELETE YOUR ACCOUNT.
      </h1>
      <Frame style={{ padding: 24 }}>
        <p style={{ fontFamily: "var(--font-mono)", marginBottom: 16, lineHeight: 1.55 }}>
          This permanently removes your auth row, profile, conversations,
          submissions, and certificates. Programs you created will be archived
          (not deleted) so other instructors / org admins can still see what
          existed for record-keeping. Audit log entries are retained for legal
          compliance.
        </p>
        <p style={{ fontFamily: "var(--font-mono)", marginBottom: 24, color: "var(--muted)" }}>
          You can&apos;t undo this. Type <strong>DELETE MY ACCOUNT</strong> below to confirm.
        </p>
        <DeleteAccountForm />
      </Frame>
    </div>
  );
}
