import * as React from "react";
import { ThemePicker } from "@/components/shell/theme-picker";
import { getThemeFromCookies } from "@/lib/theme/server";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const initialTheme = getThemeFromCookies();
  return (
    <div className="cq-shell">
      {/* Auth pages don't carry the full app header, but we still want
          theme switching available — pinned in the top-right corner so
          first-time signups can pick their aesthetic before they're in. */}
      <div
        style={{
          position: "fixed",
          top: 14,
          right: 18,
          zIndex: 50,
        }}
      >
        <ThemePicker initialTheme={initialTheme} />
      </div>
      {children}
    </div>
  );
}
