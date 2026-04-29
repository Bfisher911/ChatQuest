"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Full name required"),
  // Phase 1: this hint determines the org/membership we provision.
  intent: z.enum(["instructor", "org_admin", "learner", "ta"]).default("instructor"),
  organizationName: z.string().optional(),
  inviteToken: z.string().optional(),
});

export type SignUpResult = { ok: true } | { ok: false; error: string };

export async function signUp(formData: FormData): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    intent: formData.get("intent") ?? "instructor",
    organizationName: formData.get("organizationName") ?? undefined,
    inviteToken: formData.get("inviteToken") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password, fullName, intent, organizationName, inviteToken } = parsed.data;

  const supabase = createClient();
  const { data: signed, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { ok: false, error: error.message };
  const userId = signed.user?.id;
  if (!userId) return { ok: false, error: "Signup failed: missing user id." };

  // Provision org membership using the service role (bypasses RLS).
  const admin = createServiceRoleClient();

  if (inviteToken) {
    const { data: invite } = await admin
      .from("invites")
      .select("*")
      .eq("token", inviteToken)
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString())
      .single();
    if (!invite) return { ok: false, error: "Invite is invalid or expired." };
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return { ok: false, error: "This invite is for a different email address." };
    }
    await admin.from("organization_members").insert({
      organization_id: invite.organization_id,
      user_id: userId,
      role: invite.role,
      invited_by: invite.invited_by,
    });
    if (invite.program_id) {
      await admin.from("program_enrollments").insert({
        program_id: invite.program_id,
        user_id: userId,
        status: "active",
      });
    }
    await admin
      .from("invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", invite.id);
  } else if (intent === "org_admin") {
    const orgName = organizationName?.trim() || `${fullName}'s Organization`;
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: org } = await admin
      .from("organizations")
      .insert({ name: orgName, slug, created_by: userId })
      .select("id")
      .single();
    if (org) {
      await admin
        .from("organization_members")
        .insert({ organization_id: org.id, user_id: userId, role: "org_admin" });
    }
  } else if (intent === "instructor") {
    // Instructor without invite → bootstrap a personal "org" so they have a tenant.
    const orgName = organizationName?.trim() || `${fullName}'s Workspace`;
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: org } = await admin
      .from("organizations")
      .insert({ name: orgName, slug, org_type: "training", created_by: userId })
      .select("id")
      .single();
    if (org) {
      await admin
        .from("organization_members")
        .insert({ organization_id: org.id, user_id: userId, role: "instructor" });
    }
  }
  // Learner without invite is unusual — they remain unaffiliated until they redeem one.

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password required"),
  next: z.string().optional(),
});

export type SignInResult = { ok: true; next: string } | { ok: false; error: string };

export async function signIn(formData: FormData): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? "/dashboard",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, next: parsed.data.next || "/dashboard" };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

const forgotSchema = z.object({ email: z.string().email() });
export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/dashboard`,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
