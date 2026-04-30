// Hard-delete the caller's account. Cascades clean up via FK ON DELETE CASCADE
// on every tenant table referencing public.users(id).
//
// Programs the user created are NOT deleted — they're archived so org peers
// can still see their existence (educational record-keeping).

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();

  // Archive programs they created so we don't lose institutional history.
  await admin.from("programs").update({ status: "archived" }).eq("created_by", user.id);

  // Audit before delete.
  await admin.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "account.self_delete",
    target_type: "user",
    target_id: user.id,
  });

  // Auth deletion — cascades into public.users via FK.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sign out the current session.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
