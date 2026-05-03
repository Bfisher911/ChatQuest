"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/auth/rbac";

// ─────────── profile ───────────

const profileSchema = z.object({
  fullName: z.string().min(1, "Name required").max(120),
  displayName: z.string().min(1, "Display name required").max(60),
});

export async function updateProfile(input: z.infer<typeof profileSchema>) {
  const user = await requireSessionUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.fullName,
      display_name: parsed.data.displayName,
    })
    .eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };

  // Mirror onto auth metadata so future signup-style emails pick it up.
  const admin = createServiceRoleClient();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: parsed.data.fullName, display_name: parsed.data.displayName },
  });

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

// ─────────── password change ───────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  });

export async function changePassword(input: z.infer<typeof passwordSchema>) {
  const user = await requireSessionUser();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Re-verify current password by attempting a sign-in with it.
  const supabase = createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (signInErr) {
    return { ok: false as const, error: "Current password is incorrect." };
  }

  // Update.
  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (updateErr) return { ok: false as const, error: updateErr.message };

  return { ok: true as const };
}
