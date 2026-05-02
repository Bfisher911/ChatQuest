// Default OG image for the marketing site. Brutalist black-on-paper.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Chatrail — chatbot-native LMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          color: "#000",
          padding: 56,
          border: "12px solid #000",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <span
            style={{
              border: "4px solid #000",
              padding: "10px 16px",
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: 2,
            }}
          >
            CHAT
          </span>
          <span
            style={{
              background: "#000",
              color: "#fff",
              padding: "10px 16px",
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: 2,
              marginLeft: 6,
            }}
          >
            RAIL
          </span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 122,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: -3,
            textTransform: "uppercase",
          }}
        >
          CHATBOT-NATIVE LMS FOR SERIOUS LEARNING.
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 1,
          }}
        >
          <span>BUILD AI TUTORS · GRADE TRANSCRIPTS · ISSUE CERTIFICATES</span>
          <span>00000001</span>
        </div>
      </div>
    ),
    size,
  );
}
