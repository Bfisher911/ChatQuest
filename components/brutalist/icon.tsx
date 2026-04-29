// Brutalist iconography: 2px square-cap strokes, lucide-ish but pixel-precise.
// Ported from the design prototype's inline SVGs so we keep visual parity.

import * as React from "react";

export type IconName =
  | "search"
  | "bell"
  | "lock"
  | "globe"
  | "volume"
  | "arrow"
  | "play"
  | "plus"
  | "x"
  | "send"
  | "check"
  | "menu"
  | "grid"
  | "list"
  | "zoom-in"
  | "zoom-out"
  | "settings"
  | "user"
  | "book"
  | "file"
  | "bot"
  | "flag"
  | "award"
  | "link"
  | "slides"
  | "drag"
  | "logout"
  | "upload"
  | "download"
  | "trash";

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "square" as const,
    strokeLinejoin: "miter" as const,
    ...rest,
  };
  switch (name) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="10" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "globe":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case "volume":
      return (
        <svg {...props}>
          <path d="M4 9v6h4l5 4V5l-5 4H4z" />
          <path d="M16 8a5 5 0 0 1 0 8" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...props}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <path d="M6 4l14 8-14 8z" fill="currentColor" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "x":
      return (
        <svg {...props}>
          <path d="M5 5l14 14M19 5l-14 14" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M4 12l5 5L20 6" />
        </svg>
      );
    case "menu":
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "list":
      return (
        <svg {...props}>
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      );
    case "zoom-in":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M11 8v6M8 11h6M20 20l-3.5-3.5" />
        </svg>
      );
    case "zoom-out":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M8 11h6M20 20l-3.5-3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4.8a7 7 0 0 0-1.7-1L14 3h-4l-.8 2.7a7 7 0 0 0-1.7 1L5 6 3 9.5 5 11a7 7 0 0 0 0 2L3 14.5 5 18l2.5-.8a7 7 0 0 0 1.7 1L10 21h4l.8-2.7a7 7 0 0 0 1.7-1l2.4.8 2-3.5-2-1.5a7 7 0 0 0 .1-1z" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "book":
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
          <path d="M4 19.5V21h15" />
        </svg>
      );
    case "file":
      return (
        <svg {...props}>
          <path d="M14 3H6v18h12V7z" />
          <path d="M14 3v4h4" />
        </svg>
      );
    case "bot":
      return (
        <svg {...props}>
          <rect x="4" y="7" width="16" height="13" />
          <path d="M12 4v3M9 12h.01M15 12h.01M9 16h6" />
        </svg>
      );
    case "flag":
      return (
        <svg {...props}>
          <path d="M5 21V4h13l-2 4 2 4H5" />
        </svg>
      );
    case "award":
      return (
        <svg {...props}>
          <circle cx="12" cy="9" r="6" />
          <path d="M9 14l-2 7 5-3 5 3-2-7" />
        </svg>
      );
    case "link":
      return (
        <svg {...props}>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1" />
        </svg>
      );
    case "slides":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="14" />
          <path d="M9 21h6M12 18v3" />
        </svg>
      );
    case "drag":
      return (
        <svg {...props}>
          <circle cx="9" cy="6" r="1" fill="currentColor" />
          <circle cx="9" cy="12" r="1" fill="currentColor" />
          <circle cx="9" cy="18" r="1" fill="currentColor" />
          <circle cx="15" cy="6" r="1" fill="currentColor" />
          <circle cx="15" cy="12" r="1" fill="currentColor" />
          <circle cx="15" cy="18" r="1" fill="currentColor" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </svg>
      );
    case "upload":
      return (
        <svg {...props}>
          <path d="M12 3v14M5 10l7-7 7 7M3 21h18" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 3v14M19 10l-7 7-7-7M3 21h18" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M3 6h18M8 6V4h8v2M6 6v14h12V6M10 11v6M14 11v6" />
        </svg>
      );
    default:
      return null;
  }
}
