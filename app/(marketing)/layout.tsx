import * as React from "react";
import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cq-shell">
      <header className="cq-header">
        <div className="row" style={{ gap: 28 }}>
          <Link className="cq-logo" href="/">
            <span className="cq-logo-mark">CHAT</span>
            <span className="cq-logo-quest">QUEST</span>
          </Link>
          <nav className="cq-nav" style={{ marginLeft: 16 }}>
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/for-education">For Education</Link>
            <Link href="/for-corporate">For Corporate</Link>
          </nav>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/login" className="cq-btn cq-btn--ghost cq-btn--sm">SIGN IN</Link>
          <Link href="/signup" className="cq-btn cq-btn--sm">START FREE</Link>
        </div>
      </header>
      <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      <footer className="cq-footer">
        <div>© 2026 CHATQUEST · ALL RIGHTS RESERVED</div>
        <div className="row" style={{ gap: 18 }}>
          <Link href="/docs">DOCS</Link>
          <Link href="/terms">TERMS</Link>
          <Link href="/privacy">PRIVACY</Link>
          <Link href="/aup">AUP</Link>
        </div>
      </footer>
    </div>
  );
}
