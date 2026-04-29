import * as React from "react";
import { cx } from "@/lib/utils/cx";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  ghost?: boolean;
  accent?: boolean;
}

export function Chip({ ghost, accent, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cx(
        "cq-chip",
        ghost && "cq-chip--ghost",
        accent && "cq-chip--accent",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
