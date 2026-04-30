import * as React from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Brutalist skeleton block — solid black diagonal-stripe shimmer inside a
 * frame border. Matches the cassette card geometry.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("cq-skeleton", className)}
      style={{
        display: "block",
        width,
        height,
        background: "var(--soft)",
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.05) 4px 8px)",
        animation: "cqShimmer 1.6s linear infinite",
      }}
    />
  );
}

export function CassetteSkeleton({ small }: { small?: boolean }) {
  return (
    <div
      className="cq-cassette cq-cassette--static"
      aria-hidden="true"
      style={{ minHeight: small ? 200 : 280 }}
    >
      <Skeleton width={120} height={14} />
      <div style={{ height: 12 }} />
      <Skeleton width="80%" height={28} />
      <div style={{ height: 24 }} />
      <Skeleton width="60%" height={14} />
      <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
        <Skeleton width={50} height={20} />
        <Skeleton width={70} height={20} />
      </div>
    </div>
  );
}
