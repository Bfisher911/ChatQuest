// Theme + density preferences.
//
// Persistence lives in two cookies the server reads on every request and
// passes to the root layout, so <html data-theme + data-density> is set
// before the first paint — no theme flash.
//
// Both cookies are also mirrored to localStorage by the client provider
// for instant client-side updates without a server roundtrip.

export const THEMES = ["brutalist", "clean", "dark", "terminal"] as const;
export type Theme = (typeof THEMES)[number];

export const DENSITIES = ["cozy", "compact", "comfy"] as const;
export type Density = (typeof DENSITIES)[number];

export const THEME_COOKIE = "cq-theme";
export const DENSITY_COOKIE = "cq-density";

export const DEFAULT_THEME: Theme = "clean";
export const DEFAULT_DENSITY: Density = "cozy";

export function isTheme(value: string | null | undefined): value is Theme {
  return !!value && (THEMES as readonly string[]).includes(value);
}

export function isDensity(value: string | null | undefined): value is Density {
  return !!value && (DENSITIES as readonly string[]).includes(value);
}

/**
 * Human-readable labels for the picker UI.
 */
export const THEME_LABELS: Record<Theme, { name: string; blurb: string }> = {
  brutalist: {
    name: "Brutalist",
    blurb: "Heavy borders, ALL CAPS, the original Chatrail look.",
  },
  clean: {
    name: "Clean",
    blurb: "Modern SaaS — soft borders, rounded corners, sentence case.",
  },
  dark: {
    name: "Dark",
    blurb: "Dark palette, easy on the eyes for long sessions.",
  },
  terminal: {
    name: "Terminal",
    blurb: "Retro green-on-black mono. For the keyboard maximalists.",
  },
};

export const DENSITY_LABELS: Record<Density, string> = {
  cozy: "Cozy (default)",
  compact: "Compact",
  comfy: "Spacious",
};
