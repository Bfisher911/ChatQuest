"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { setOrgAccentColor } from "../actions";

/**
 * Brand-color customizer.
 *
 * Org admins pick a hex accent color that overrides the active theme's
 * --accent token for everyone in the org. Includes:
 *   - A handful of curated swatches (sensible "we have a brand" defaults)
 *   - A native color input for full control
 *   - A live preview tile showing how the color renders against accent-fg
 *   - "Use theme default" to clear and fall back to the theme's accent
 *
 * The user's optimistic preview applies the new accent locally via a
 * --accent override on the shell wrapper, so they see the change before
 * the server action returns.
 */

const PRESETS: { label: string; value: string }[] = [
  { label: "Royal blue", value: "#2657ff" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Teal", value: "#0d9488" },
  { label: "Forest", value: "#15803d" },
  { label: "Crimson", value: "#dc2626" },
  { label: "Sienna", value: "#b04a2a" },
  { label: "Amber", value: "#d97706" },
  { label: "Plum", value: "#8b5cf6" },
  { label: "Slate", value: "#475569" },
  { label: "Ink", value: "#0f1219" },
];

export function BrandColorForm({
  organizationId,
  initialAccent,
}: {
  organizationId: string;
  initialAccent: string | null;
}) {
  const router = useRouter();
  const [accent, setAccent] = React.useState<string | null>(initialAccent);
  const [pending, setPending] = React.useState(false);

  // Apply / clear the optimistic override on the shell wrapper. The shell
  // is the topmost div with class "cq-shell" — by setting --accent there
  // we override anything below it.
  function applyOptimistic(next: string | null) {
    const shell = document.querySelector<HTMLElement>(".cq-shell");
    if (!shell) return;
    if (next) {
      shell.style.setProperty("--accent", next);
      // Pick a sensible accent foreground (white for darker hexes, near-black
      // for lighter ones) so accent-on-accent text remains readable.
      shell.style.setProperty("--accent-fg", contrastFg(next));
    } else {
      shell.style.removeProperty("--accent");
      shell.style.removeProperty("--accent-fg");
    }
  }

  async function save(next: string | null) {
    setPending(true);
    applyOptimistic(next);
    setAccent(next);
    const res = await setOrgAccentColor({
      organizationId,
      accentColor: next,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      // Roll back optimistic.
      applyOptimistic(initialAccent);
      setAccent(initialAccent);
      return;
    }
    toast.success(next ? "Brand color saved." : "Brand color cleared — using theme default.");
    router.refresh();
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 4,
        }}
      >
        {PRESETS.map((p) => {
          const isActive = accent?.toLowerCase() === p.value.toLowerCase();
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => save(p.value)}
              disabled={pending}
              title={p.label}
              aria-pressed={isActive}
              aria-label={`Set brand color to ${p.label}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius)",
                border: isActive
                  ? "2px solid var(--ink)"
                  : "var(--hair) solid var(--line, var(--ink))",
                background: p.value,
                cursor: pending ? "wait" : "pointer",
                position: "relative",
                padding: 0,
                outlineOffset: 2,
              }}
            >
              {isActive ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: contrastFg(p.value),
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className="row"
        style={{
          gap: 12,
          marginTop: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          Custom hex
          <input
            type="color"
            value={accent ?? "#2657ff"}
            onChange={(e) => save(e.target.value)}
            disabled={pending}
            aria-label="Custom brand color"
            style={{
              width: 36,
              height: 36,
              border: "var(--hair) solid var(--line, var(--ink))",
              borderRadius: "var(--radius)",
              padding: 0,
              cursor: pending ? "wait" : "pointer",
              background: "transparent",
            }}
          />
        </label>

        <span
          className="cq-mono"
          style={{ fontSize: 12, color: "var(--muted)" }}
        >
          {accent ?? "Theme default"}
        </span>

        {accent ? (
          <Btn sm ghost disabled={pending} onClick={() => save(null)}>
            <Icon name="x" /> Use theme default
          </Btn>
        ) : null}
      </div>

      {/* Live preview — shows how a button + chip + accent text render */}
      <div
        style={{
          marginTop: 18,
          padding: 14,
          border: "var(--hair) solid var(--line, var(--ink))",
          borderRadius: "var(--radius)",
          background: "var(--soft)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            minWidth: 60,
          }}
        >
          Preview
        </div>
        <span
          style={{
            background: accent ?? "var(--accent)",
            color: contrastFg(accent ?? "#2657ff"),
            padding: "6px 12px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Primary button
        </span>
        <span
          style={{
            border: `2px solid ${accent ?? "var(--accent)"}`,
            color: accent ?? "var(--accent)",
            padding: "5px 10px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          Highlight
        </span>
        <a
          href="#preview"
          onClick={(e) => e.preventDefault()}
          style={{
            color: accent ?? "var(--accent)",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Sample link →
        </a>
      </div>

      <p
        style={{
          marginTop: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.55,
        }}
      >
        Applies to every member in this org. Personal theme choice
        (brutalist / clean / dark / sepia / terminal / high-contrast) still
        wins for everything else; this only swaps the accent color.
      </p>
    </div>
  );
}

/**
 * Pick a foreground color (white or near-black) that contrasts well
 * against the given hex background. Cheap WCAG-ish heuristic — luminance
 * threshold at 0.55. Good enough for accent buttons; not a substitute
 * for a full WCAG checker.
 */
function contrastFg(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  // Relative luminance per WCAG.
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? "#0f1219" : "#ffffff";
}
