"use client";

import * as React from "react";
import { Icon, IconBtn } from "@/components/brutalist";
import { THEMES, THEME_LABELS, type Theme } from "@/lib/theme";
import { setThemeCookie } from "@/lib/theme/actions";

/**
 * Compact theme picker for the app header.
 *
 * Click the palette icon → popover with the four themes. Picking one fires
 * the server action (which sets the cookie + revalidates the layout) AND
 * applies the new `data-theme` attribute on <html> immediately so the user
 * sees the change without waiting for the navigation.
 */
export function ThemePicker({ initialTheme }: { initialTheme: Theme }) {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<Theme>(initialTheme);
  const [pending, setPending] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(next: Theme) {
    setPending(true);
    // Optimistic — flip <html data-theme> immediately so the visual change
    // happens before the server action returns.
    document.documentElement.setAttribute("data-theme", next);
    setCurrent(next);
    await setThemeCookie(next);
    setPending(false);
    setOpen(false);
  }

  return (
    <div ref={popoverRef} style={{ position: "relative" }}>
      <IconBtn
        title="Theme"
        aria-label="Theme picker"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
      >
        <Icon name="palette" />
      </IconBtn>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 280,
            background: "var(--paper)",
            border: "var(--hair) solid var(--line)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md, 0 8px 24px rgba(0,0,0,0.15))",
            padding: 8,
            zIndex: 1000,
          }}
        >
          <div
            className="cq-eyebrow"
            style={{
              padding: "6px 10px 8px",
              color: "var(--muted)",
              fontSize: 10,
            }}
          >
            Theme
          </div>
          {THEMES.map((theme) => {
            const meta = THEME_LABELS[theme];
            const isActive = theme === current;
            return (
              <button
                key={theme}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => pick(theme)}
                disabled={pending}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  background: isActive ? "var(--soft)" : "transparent",
                  color: "var(--ink)",
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: "calc(var(--radius) - 2px)",
                  font: "inherit",
                }}
              >
                <ThemeSwatch theme={theme} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      fontSize: 13,
                      letterSpacing: 0,
                      textTransform: "none",
                    }}
                  >
                    {meta.name}
                    {isActive ? (
                      <span
                        aria-hidden
                        style={{ marginLeft: 6, color: "var(--muted)", fontWeight: 400 }}
                      >
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--muted)",
                      lineHeight: 1.45,
                      marginTop: 2,
                    }}
                  >
                    {meta.blurb}
                  </span>
                </span>
              </button>
            );
          })}
          <div
            className="cq-mono"
            style={{
              padding: "8px 12px 4px",
              fontSize: 10,
              color: "var(--muted)",
              borderTop: "var(--hair) solid var(--line)",
              marginTop: 6,
            }}
          >
            More options in <a href="/account" style={{ textDecoration: "underline" }}>Account → Appearance</a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 24×24 swatch previewing each theme's ink/paper/accent — gives the picker
 * a real visual signal of the choice instead of just a name.
 */
function ThemeSwatch({ theme }: { theme: Theme }) {
  // The "system" theme uses a diagonal half-light / half-dark split so the
  // user sees that it's "auto" rather than a fixed palette.
  if (theme === "system") {
    return (
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          border: "1px solid var(--line)",
          borderRadius: 4,
          background:
            "linear-gradient(135deg, #ffffff 0%, #ffffff 49%, #0f1219 51%, #0f1219 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#2657ff",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#6c8cff",
          }}
        />
      </span>
    );
  }
  const palettes: Record<Exclude<Theme, "system">, { paper: string; ink: string; accent: string; line?: string }> = {
    brutalist: { paper: "#ffffff", ink: "#000000", accent: "#000000" },
    clean: { paper: "#ffffff", ink: "#0f1219", accent: "#2657ff", line: "#d8dde6" },
    dark: { paper: "#0f1219", ink: "#e6e9ef", accent: "#6c8cff", line: "#2a3140" },
    terminal: { paper: "#000000", ink: "#33ff66", accent: "#33ff66" },
  };
  const p = palettes[theme];
  return (
    <span
      aria-hidden
      style={{
        display: "inline-grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        width: 28,
        height: 28,
        flexShrink: 0,
        border: `1px solid ${p.line ?? p.ink}`,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <span style={{ background: p.paper }} />
      <span style={{ background: p.ink }} />
      <span style={{ background: p.accent }} />
      <span style={{ background: p.paper }} />
    </span>
  );
}
