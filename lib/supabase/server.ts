// Server-side Supabase client. Reads cookies so RLS sees the right user.
// Use this in server components, server actions, and route handlers.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server component context: writing cookies is a no-op here.
            // Middleware refreshes tokens; this is fine.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // see above
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Use ONLY when:
 *   - You're handling a webhook with no logged-in user.
 *   - You're doing a system operation that genuinely should bypass RLS
 *     (background indexing, billing webhook, etc.).
 *
 * Never expose this client to the browser. Never accept an org id from the
 * request without verifying the caller is allowed to act on it.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE service-role configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
