// Server-side theme + density resolution from cookies. Used by the root
// layout so the <html> element is rendered with the right data attributes
// before any paint — no theme flash on first load.

import { cookies } from "next/headers";
import {
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  DENSITY_COOKIE,
  THEME_COOKIE,
  isDensity,
  isTheme,
  type Density,
  type Theme,
} from "./index";

export function getThemeFromCookies(): Theme {
  const c = cookies().get(THEME_COOKIE)?.value;
  return isTheme(c) ? c : DEFAULT_THEME;
}

export function getDensityFromCookies(): Density {
  const c = cookies().get(DENSITY_COOKIE)?.value;
  return isDensity(c) ? c : DEFAULT_DENSITY;
}
