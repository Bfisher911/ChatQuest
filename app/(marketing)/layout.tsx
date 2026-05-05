import * as React from "react";
import Link from "next/link";
import { ThemePicker } from "@/components/shell/theme-picker";
import { getThemeFromCookies } from "@/lib/theme/server";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const initialTheme = getThemeFromCookies();
  return (
    <div className="cq-shell">
      <header className="cq-header">
        <div className="row" style={{ gap: 28 }}>
          <Link className="cq-logo" href="/">
            <span className="cq-logo-mark">CHAT</span>
            <span className="cq-logo-quest">RAIL</span>
          </Link>
          <nav className="cq-nav" style={{ marginLeft: 16 }}>
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/for-education">For Education</Link>
            <Link href="/for-corporate">For Corporate</Link>
          </nav>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <ThemePicker initialTheme={initialTheme} />
          <Link href="/login" className="cq-btn cq-btn--ghost cq-btn--sm">Sign in</Link>
          <Link href="/signup" className="cq-btn cq-btn--sm">Start free</Link>
        </div>
      </header>
      <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      <footer className="cq-footer">
        <div>© 2026 Chatrail · All rights reserved</div>
        <div className="row" style={{ gap: 18 }}>
          <Link href="/docs">Docs</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/aup">AUP</Link>
        </div>
      </footer>
    </div>
  );
}
