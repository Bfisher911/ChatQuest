// Stream the caller's data as a JSON archive.

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const [{ data: profile }, { data: memberships }, { data: enrollments }, { data: programs }, { data: convs }, { data: subs }, { data: grades }, { data: certs }] =
    await Promise.all([
      admin.from("users").select("*").eq("id", user.id).single(),
      admin.from("organization_members").select("*").eq("user_id", user.id),
      admin.from("program_enrollments").select("*").eq("user_id", user.id),
      admin.from("programs").select("*").eq("created_by", user.id),
      admin
        .from("conversations")
        .select("*, conversation_messages(role, content, created_at)")
        .eq("learner_id", user.id),
      admin.from("submissions").select("*").eq("learner_id", user.id),
      admin.from("grades").select("*").or(`learner_id.eq.${user.id},graded_by.eq.${user.id}`),
      admin.from("certificate_awards").select("*").eq("learner_id", user.id),
    ]);

  const archive = {
    exported_at: new Date().toISOString(),
    profile,
    memberships,
    enrollments,
    programs_created: programs,
    conversations: convs,
    submissions: subs,
    grades,
    certificate_awards: certs,
  };

  return new NextResponse(JSON.stringify(archive, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="chatquest-${user.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
