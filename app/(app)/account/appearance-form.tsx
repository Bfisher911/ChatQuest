"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import {
  THEMES,
  THEME_LABELS,
  DENSITIES,
  DENSITY_LABELS,
  type Theme,
  type Density,
} from "@/lib/theme";
import { setThemeCookie, setDensityCookie } from "@/lib/theme/actions";

/**
 * Account → Appearance: card-style theme picker + density toggle.
 *
 * Each theme is a clickable card showing a representative swatch + name +
 * blurb. The current theme is highlighted. Density is a row of three pills.
 *
 * Selections apply optimistically (mutate <html> attributes immediately)
 * and persist via server actions that set cookies the layout reads on the
 * next render.
 */
export function AppearanceForm({
  initialTheme,
  initialDensity,
}: {
  initialTheme: Theme;
  initialDensity: Density;
}) {
  const [theme, setTheme] = React.useState<Theme>(initialTheme);
  const [density, setDensity] = React.useState<Density>(initialDensity);
  const [pending, setPending] = React.useState(false);

  async function pickTheme(next: Theme) {
    if (next === theme || pending) return;
    setPending(true);
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    const res = await setThemeCookie(next);
    setPending(false);
    if (!res.ok) toast.error("Couldn't save theme.");
    else toast.success(`Theme: ${THEME_LABELS[next].name}`);
  }

  async function pickDensity(next: Density) {
    if (next === density || pending) return;
    setPending(true);
    document.documentElement.setAttribute("data-density", next);
    setDensity(next);
    const res = await setDensityCookie(next);
    setPending(false);
    if (!res.ok) toast.error("Couldn't save density.");
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        {THEMES.map((t) => (
          <ThemeCard
            key={t}
            theme={t}
            isActive={t === theme}
            disabled={pending}
            onPick={() => pickTheme(t)}
          />
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <div
          className="cq-mono"
          style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, letterSpacing: "0.06em" }}
        >
          DENSITY
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {DENSITIES.map((d) => (
            <Btn
              key={d}
              sm
              ghost={d !== density}
              disabled={pending}
              onClick={() => pickDensity(d)}
            >
              {d === density ? <Icon name="check" /> : null}
              {DENSITY_LABELS[d]}
            </Btn>
          ))}
        </div>
      </div>

      <p
        style={{
          marginTop: 20,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        Your choice is stored in a cookie on this device. Sign out of other
        browsers to apply it elsewhere, or pick again from those sessions.
      </p>
    </div>
  );
}

function ThemeCard({
  theme,
  isActive,
  disabled,
  onPick,
}: {
  theme: Theme;
  isActive: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const meta = THEME_LABELS[theme];
  // Each card is rendered as a self-contained scope of the chosen theme by
  // applying its own data-theme override locally — the swatch shows real
  // theme colors, not just a tile abstraction.
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      data-theme={theme}
      aria-pressed={isActive}
      style={{
        display: "block",
        textAlign: "left",
        padding: 14,
        background: "var(--paper)",
        color: "var(--ink)",
        border: `${isActive ? 2 : 1}px solid ${isActive ? "var(--accent)" : "var(--line)"}`,
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-sm)",
        cursor: disabled ? "wait" : "pointer",
        font: "inherit",
        position: "relative",
      }}
    >
      <ThemePreview />
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "var(--ls-title)",
            textTransform: "var(--tt-display)" as React.CSSProperties["textTransform"],
          }}
        >
          {meta.name}
        </span>
        {isActive ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--accent)",
            }}
          >
            ✓ ACTIVE
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.45,
          minHeight: 32,
        }}
      >
        {meta.blurb}
      </div>
    </button>
  );
}

/**
 * Mini preview that uses the surrounding theme tokens — shows a header
 * stripe, a button, and a chip rendered the way that theme would render
 * them in the real app.
 */
function ThemePreview() {
  return (
    <div
      style={{
        background: "var(--soft)",
        border: "var(--hair) solid var(--line)",
        borderRadius: "calc(var(--radius) - 2px)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display, var(--font-pixel))",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "var(--tt-eyebrow, uppercase)" as React.CSSProperties["textTransform"],
            color: "var(--muted)",
          }}
        >
          PREVIEW
        </span>
        <span
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "2px 7px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "var(--tt-chip, uppercase)" as React.CSSProperties["textTransform"],
            borderRadius: "calc(var(--radius) - 4px)",
          }}
        >
          Chip
        </span>
      </div>
      <div
        style={{
          background: "var(--accent)",
          color: "var(--accent-fg)",
          padding: "6px 10px",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: 11,
          textAlign: "center",
          textTransform: "var(--tt-button, uppercase)" as React.CSSProperties["textTransform"],
          borderRadius: "calc(var(--radius) - 4px)",
        }}
      >
        Button
      </div>
    </div>
  );
}
