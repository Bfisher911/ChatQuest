import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Btn, Icon, Frame } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function ExportDataPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="cq-page" style={{ maxWidth: 720 }}>
      <Eyebrow>ACCOUNT · EXPORT DATA</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 16 }}>
        DOWNLOAD YOUR DATA.
      </h1>
      <Frame style={{ padding: 24 }}>
        <p style={{ fontFamily: "var(--font-mono)", marginBottom: 16, lineHeight: 1.55 }}>
          Click the button below to generate a JSON archive of:
        </p>
        <ul style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.6, paddingLeft: 20 }}>
          <li>your profile</li>
          <li>org memberships</li>
          <li>programs you created (instructors)</li>
          <li>conversations + submissions + grades you authored or received</li>
          <li>certificates you've been awarded</li>
        </ul>
        <p style={{ fontFamily: "var(--font-mono)", marginTop: 16, color: "var(--muted)" }}>
          Note: KB files you uploaded are not included in the JSON; download
          them individually from each program's Knowledge tab.
        </p>
        <div style={{ marginTop: 24 }}>
          <Btn asChild>
            <a href="/api/account/export" target="_blank" rel="noreferrer">
              <Icon name="download" /> EXPORT JSON
            </a>
          </Btn>
        </div>
      </Frame>
    </div>
  );
}
