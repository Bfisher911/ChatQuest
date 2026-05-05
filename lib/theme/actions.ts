"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DENSITY_COOKIE,
  THEME_COOKIE,
  isDensity,
  isTheme,
  type Density,
  type Theme,
} from "./index";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist a theme choice for the current visitor.
 *
 * The cookie is set on the `cq-theme` name and lives for one year. It's
 * read on every server render via `getThemeFromCookies()` so the next
 * navigation picks up the new theme without any client roundtrip.
 *
 * Anonymous visitors get a cookie too — theme is independent of auth.
 */
export async function setThemeCookie(value: string): Promise<{ ok: boolean; theme?: Theme }> {
  if (!isTheme(value)) return { ok: false };
  cookies().set(THEME_COOKIE, value, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
  // Re-render every cached page so the new <html data-theme> renders.
  revalidatePath("/", "layout");
  return { ok: true, theme: value };
}

export async function setDensityCookie(value: string): Promise<{ ok: boolean; density?: Density }> {
  if (!isDensity(value)) return { ok: false };
  cookies().set(DENSITY_COOKIE, value, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
  return { ok: true, density: value };
}
