// Refreshes Supabase auth tokens on every request and lets us redirect
// unauthenticated users away from protected routes.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/features",
  "/pricing",
  "/for-education",
  "/for-corporate",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify",
  "/aup",
  "/privacy",
  "/terms",
  "/sitemap.xml",
  "/robots.txt",
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) ||
  pathname.startsWith("/auth/") ||
  pathname.startsWith("/accept-invite/") ||
  pathname.startsWith("/verify-cert/") ||
  pathname.startsWith("/docs") ||
  pathname.startsWith("/_next") ||
  pathname.startsWith("/api/auth/") ||
  pathname.startsWith("/api/stripe/webhook") ||
  // Operational endpoints — uptime / status pollers must hit these
  // without an auth session. /api/health does a quick reachability
  // probe; /api/diagnostics does a real LLM ping. Both are useful
  // when debugging "why is my AI not working" and shouldn't be
  // hidden behind login.
  pathname === "/api/health" ||
  pathname === "/api/diagnostics" ||
  pathname.startsWith("/opengraph-image");

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Already authed and trying to view login/signup → bounce to dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
