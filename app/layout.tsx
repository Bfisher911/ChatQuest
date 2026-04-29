import type { Metadata } from "next";
import "../styles/globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "ChatQuest — Chatbot-native LMS",
  description:
    "Build AI tutors. Wire them into a visual learning path. Grade transcripts with rubrics. Issue certificates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Brutalist fonts — three-stack matches the prototype exactly. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@500;700;800&family=VT323&display=swap"
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
              borderRadius: 0,
              border: "2px solid var(--ink)",
              background: "var(--paper)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            },
          }}
        />
      </body>
    </html>
  );
}
