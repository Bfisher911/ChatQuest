"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";

const inviteSchema = z.object({
  programId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["learner", "ta", "instructor"]).default("learner"),
});

function token() {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function inviteLearner(formData: FormData) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const parsed = inviteSchema.safeParse({
    programId: formData.get("programId"),
    email: formData.get("email"),
    role: formData.get("role") || "learner",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const admin = createServiceRoleClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, organization_id")
    .eq("id", parsed.data.programId)
    .single();
  if (!program) return { ok: false as const, error: "Program not found" };

  // Already-existing user?
  const { data: existingUser } = await admin
    .from("users")
    .select("id, email")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (existingUser) {
    // Add membership (idempotent) + enrollment (idempotent).
    await admin.from("organization_members").upsert(
      {
        organization_id: program.organization_id,
        user_id: existingUser.id,
        role: parsed.data.role,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (parsed.data.role === "learner") {
      await admin
        .from("program_enrollments")
        .upsert(
          { program_id: program.id, user_id: existingUser.id, status: "active" },
          { onConflict: "program_id,user_id" },
        );
    } else if (parsed.data.role === "instructor" || parsed.data.role === "ta") {
      await admin
        .from("program_instructors")
        .upsert(
          { program_id: program.id, user_id: existingUser.id, capacity: parsed.data.role === "ta" ? "ta" : "co_instructor" },
          { onConflict: "program_id,user_id" },
        );
    }
    revalidatePath(`/programs/${program.id}/roster`);
    return { ok: true as const, addedExistingUser: true };
  }

  const newToken = token();
  const { error: inviteErr } = await admin.from("invites").insert({
    organization_id: program.organization_id,
    program_id: program.id,
    email: parsed.data.email,
    role: parsed.data.role,
    token: newToken,
    invited_by: session.user.id,
  });
  if (inviteErr) return { ok: false as const, error: inviteErr.message };

  // Phase 1: log invite link to server console if no email provider configured.
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invite/${newToken}`;
  if (!process.env.RESEND_API_KEY) {
    console.log(`[invite] ${parsed.data.email} → ${url}`);
  } else {
    // Real send via Resend (POST); not awaited synchronously to keep things snappy.
    void fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "ChatQuest <noreply@chatquest.local>",
        to: [parsed.data.email],
        subject: "You're invited to ChatQuest",
        html: `<p>Click to join: <a href="${url}">${url}</a></p>`,
      }),
    }).catch((err) => console.error("[invite] resend failed:", err));
  }

  revalidatePath(`/programs/${program.id}/roster`);
  return { ok: true as const, inviteUrl: url };
}

const csvSchema = z.object({ programId: z.string().uuid(), csv: z.string().min(1) });
export async function inviteCsv(formData: FormData) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const parsed = csvSchema.safeParse({
    programId: formData.get("programId"),
    csv: formData.get("csv"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const lines = parsed.data.csv
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l && !l.toLowerCase().startsWith("email"));
  let added = 0;
  let errors = 0;
  const links: string[] = [];

  for (const line of lines) {
    const email = line.split(",")[0]?.trim();
    if (!email || !email.includes("@")) {
      errors++;
      continue;
    }
    const fd = new FormData();
    fd.set("programId", parsed.data.programId);
    fd.set("email", email);
    fd.set("role", "learner");
    const res = await inviteLearner(fd);
    if (res.ok) {
      added++;
      if ("inviteUrl" in res && res.inviteUrl) links.push(res.inviteUrl);
    } else {
      errors++;
    }
  }
  return { ok: true as const, added, errors, links };
}
