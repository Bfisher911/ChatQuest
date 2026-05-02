import * as React from "react";
import { bin } from "@/lib/utils/binary";

export function Footer({ index = 1, total = 1 }: { index?: number; total?: number }) {
  return (
    <footer className="cq-footer">
      <div>© 2026 CHATRAIL · ALL RIGHTS RESERVED</div>
      <div className="row" style={{ gap: 12 }}>
        <span style={{ fontSize: 11 }}>SCREEN</span>
        <div className="cq-footer-counter">
          <span className="n">{bin(index, 4)}</span>
          <span style={{ fontSize: 11 }}>/ {bin(total, 4)}</span>
        </div>
      </div>
    </footer>
  );
}
