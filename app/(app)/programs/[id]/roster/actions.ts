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
    .select("id, organization_id, learner_pays")
    .eq("id", parsed.data.programId)
    .single();
  if (!program) return { ok: false as const, error: "Program not found" };

  // Plan-feature seat enforcement (Phase D).
  if (parsed.data.role === "learner" && !program.learner_pays) {
    const { canSeatLearner } = await import("@/lib/billing/gate");
    const seat = await canSeatLearner(program.organization_id);
    if (!seat.ok) return { ok: false as const, error: seat.reason };
  }
  if (parsed.data.role === "instructor" || parsed.data.role === "ta") {
    const { canSeatInstructor } = await import("@/lib/billing/gate");
    const seat = await canSeatInstructor(program.organization_id);
    if (!seat.ok) return { ok: false as const, error: seat.reason };
  }

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
    // Fire an in-app notification — the existing user is added immediately.
    const { data: program2 } = await admin
      .from("programs")
      .select("title")
      .eq("id", program.id)
      .single();
    const { createNotification } = await import("@/lib/notifications/create");
    await createNotification({
      userId: existingUser.id,
      organizationId: program.organization_id,
      kind: "invite_received",
      title:
        parsed.data.role === "learner"
          ? `Added to Chatrail: ${program2?.title ?? "(untitled)"}`
          : `Added as ${parsed.data.role.toUpperCase()} to: ${program2?.title ?? "(untitled)"}`,
      body: parsed.data.role === "learner"
        ? "You can start the journey now."
        : "You can edit + grade in this Chatrail.",
      href:
        parsed.data.role === "learner"
          ? `/learn/${program.id}`
          : `/programs/${program.id}`,
    });

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

  // Send the branded invite email (Phase B).
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invite/${newToken}`;
  const { data: program2 } = await admin
    .from("programs")
    .select("title")
    .eq("id", program.id)
    .single();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", program.organization_id)
    .single();
  const { renderInviteEmail } = await import("@/lib/email/templates");
  const { sendEmail } = await import("@/lib/email/client");
  const tpl = renderInviteEmail({
    inviteUrl: url,
    inviterName: session.user.fullName ?? session.user.displayName ?? session.user.email,
    organizationName: org?.name ?? "Your team",
    programTitle: program2?.title ?? null,
    role: parsed.data.role,
  });
  // Fire-and-forget — don't block the server action on the email POST.
  void sendEmail({ to: parsed.data.email, subject: tpl.subject, html: tpl.html, text: tpl.text }).then((r) => {
    if (!r.ok) console.error("[invite] email send failed:", r.error);
  });

  revalidatePath(`/programs/${program.id}/roster`);
  return { ok: true as const, inviteUrl: url };
}

// ─────────── revoke a pending invite ───────────

export async function revokeInvite(inviteId: string, programId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can revoke invites." };
  }
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("program_id", programId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/programs/${programId}/roster`);
  return { ok: true as const };
}

// ─────────── remove a learner from a Chatrail ───────────

export async function removeLearnerFromProgram(learnerUserId: string, programId: string) {
  const session = await getActiveRole();
  if (!session) return { ok: false as const, error: "Not signed in" };
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    return { ok: false as const, error: "Only Creators can remove learners." };
  }
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("program_enrollments")
    .delete()
    .eq("user_id", learnerUserId)
    .eq("program_id", programId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/programs/${programId}/roster`);
  revalidatePath("/seats");
  return { ok: true as const };
}

const csvSchema = z.object({ programId: z.string().uuid(), csv: z.string().min(1) });

// ─────────── Phase U — CSV preview + commit ───────────
//
// Two-step flow so creators see exactly which rows will be processed (and
// which will fail) BEFORE anything is written. Preview is pure parse +
// validation; commit calls the same per-row invite path.

export type CsvRowStatus = "valid" | "duplicate" | "invalid_email" | "missing_email";

export interface CsvPreviewRow {
  index: number;
  email: string;
  fullName: string | null;
  role: "learner" | "ta" | "instructor";
  status: CsvRowStatus;
  reason?: string;
  /** True if a user with this email already exists in the org (will be added directly, not emailed). */
  existingMember?: boolean;
}

const previewSchema = z.object({
  programId: z.string().uuid(),
  csv: z.string().min(1),
});

/**
 * Parse a CSV (header optional) into validated rows without writing anything.
 *
 * Accepted columns (in any order, with or without a header line):
 *   email, name (optional), role (optional — defaults to learner)
 *
 * If no header line, columns are positional: email, name, role.
 */
export async function previewCsvImport(input: z.infer<typeof previewSchema>) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const admin = createServiceRoleClient();
  // Active members of the program's org — used to mark "duplicate" rows in preview.
  const { data: program } = await admin
    .from("programs")
    .select("organization_id")
    .eq("id", parsed.data.programId)
    .single();
  if (!program) return { ok: false as const, error: "Chatrail not found" };
  if (program.organization_id !== session.activeOrganizationId && !session.user.isSuperAdmin) {
    return { ok: false as const, error: "Wrong organization." };
  }

  const { data: existingUsers } = await admin
    .from("organization_members")
    .select("user:users(email)")
    .eq("organization_id", program.organization_id)
    .eq("is_active", true);
  type MemberRow = { user: { email: string } | { email: string }[] | null };
  const memberEmails = new Set<string>();
  for (const m of (existingUsers ?? []) as unknown as MemberRow[]) {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    if (u?.email) memberEmails.add(u.email.toLowerCase());
  }

  // Already-pending invites for this program — also "duplicate".
  const { data: pendingInvites } = await admin
    .from("invites")
    .select("email")
    .eq("program_id", parsed.data.programId)
    .eq("status", "pending");
  const pendingEmails = new Set<string>(
    (pendingInvites ?? []).map((i) => i.email.toLowerCase()),
  );

  const lines = parsed.data.csv
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { ok: true as const, rows: [], duplicates: 0 };
  }

  // Detect a header row.
  const header = lines[0]
    .split(",")
    .map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""));
  const hasHeader = header.includes("email");
  const colIndex = (name: string) => header.indexOf(name);
  const emailCol = hasHeader ? colIndex("email") : 0;
  const nameCol = hasHeader ? colIndex("name") : 1;
  const roleCol = hasHeader ? colIndex("role") : 2;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const seenInBatch = new Set<string>();
  const rows: CsvPreviewRow[] = [];
  let dupCount = 0;
  dataLines.forEach((line, i) => {
    const cells = parseCsvLine(line);
    const rawEmail = (cells[emailCol] ?? "").trim().replace(/^"|"$/g, "");
    const rawName = nameCol >= 0 && nameCol < cells.length ? cells[nameCol].trim().replace(/^"|"$/g, "") : "";
    const rawRole = roleCol >= 0 && roleCol < cells.length ? cells[roleCol].trim().toLowerCase().replace(/^"|"$/g, "") : "learner";
    const role: "learner" | "ta" | "instructor" =
      rawRole === "ta" || rawRole === "instructor" ? rawRole : "learner";

    if (!rawEmail) {
      rows.push({ index: i, email: "", fullName: rawName || null, role, status: "missing_email" });
      return;
    }
    if (!isValidEmail(rawEmail)) {
      rows.push({ index: i, email: rawEmail, fullName: rawName || null, role, status: "invalid_email" });
      return;
    }
    const lower = rawEmail.toLowerCase();
    if (seenInBatch.has(lower) || memberEmails.has(lower) || pendingEmails.has(lower)) {
      dupCount++;
      rows.push({
        index: i,
        email: rawEmail,
        fullName: rawName || null,
        role,
        status: "duplicate",
        reason: memberEmails.has(lower) ? "already a member" : pendingEmails.has(lower) ? "already invited" : "duplicate in CSV",
        existingMember: memberEmails.has(lower),
      });
      return;
    }
    seenInBatch.add(lower);
    rows.push({
      index: i,
      email: rawEmail,
      fullName: rawName || null,
      role,
      status: "valid",
      existingMember: false,
    });
  });

  return { ok: true as const, rows, duplicates: dupCount };
}

const commitSchema = z.object({
  programId: z.string().uuid(),
  rows: z.array(
    z.object({
      email: z.string().email(),
      fullName: z.string().nullable().optional(),
      role: z.enum(["learner", "ta", "instructor"]),
    }),
  ),
});

export async function commitCsvImport(input: z.infer<typeof commitSchema>) {
  const session = await getActiveRole();
  if (!session?.activeOrganizationId) return { ok: false as const, error: "No active organization" };
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  let added = 0;
  let errors = 0;
  const errorsList: { email: string; reason: string }[] = [];

  for (const row of parsed.data.rows) {
    const fd = new FormData();
    fd.set("programId", parsed.data.programId);
    fd.set("email", row.email);
    fd.set("role", row.role);
    const res = await inviteLearner(fd);
    if (res.ok) {
      added++;
    } else {
      errors++;
      errorsList.push({ email: row.email, reason: res.error });
    }
  }
  return { ok: true as const, added, errors, errorsList };
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV parser — handles quoted fields with commas inside.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function isValidEmail(s: string): boolean {
  // Pragmatic — covers typical input without overreaching.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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
