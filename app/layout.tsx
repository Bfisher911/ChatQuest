import type { Metadata } from "next";
import "../styles/globals.css";
import { Toaster } from "sonner";
import { getDensityFromCookies, getThemeFromCookies } from "@/lib/theme/server";

export const metadata: Metadata = {
  title: "Chatrail — Build chatbot-native learning paths",
  description:
    "Build AI tutors. Wire them into visual learning paths called Chatrails. Provision seats. Grade transcripts. Issue certificates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read user theme + density preference from cookies on every render so
  // <html> ships with the right data-theme attribute before paint. No flash.
  const theme = getThemeFromCookies();
  const density = getDensityFromCookies();

  return (
    <html lang="en" data-theme={theme} data-density={density}>
      <head>
        {/* All four themes can pull from this combined font stack. The
            brutalist theme wants Space Grotesk + VT323 + Press Start 2P;
            clean / dark want Inter + JetBrains Mono. We load all of them
            once so theme switching is instant client-side. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Press+Start+2P&family=Space+Grotesk:wght@500;700;800&family=VT323&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-sans: "Space Grotesk", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
            --font-mono: "VT323", "IBM Plex Mono", ui-monospace, Menlo, monospace;
            --font-pixel: "Press Start 2P", "VT323", monospace;
          }
        `}</style>
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "var(--radius)",
              border: "var(--hair) solid var(--line)",
              background: "var(--paper)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              letterSpacing: "0.04em",
            },
          }}
        />
      </body>
    </html>
  );
}
