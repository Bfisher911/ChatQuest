import * as React from "react";
import { cx } from "@/lib/utils/cx";

/** Pixel-font label, "■ FEATURED CAPABILITIES" style. */
export function Eyebrow({
  children,
  bullet = true,
  className,
}: {
  children: React.ReactNode;
  bullet?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("cq-eyebrow", className)}>
      {bullet ? "■ " : null}
      {children}
    </div>
  );
}

export function Frame({
  children,
  thin,
  className,
  style,
}: {
  children: React.ReactNode;
  thin?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cx("cq-frame", thin && "cq-frame--thin", className)}
      style={style}
    >
      {children}
    </div>
  );
}
