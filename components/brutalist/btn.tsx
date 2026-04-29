import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cx } from "@/lib/utils/cx";

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ghost?: boolean;
  accent?: boolean;
  sm?: boolean;
  asChild?: boolean;
}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { ghost, accent, sm, asChild, className, type = "button", ...rest },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  // When rendering via Slot, the consumer's element provides the type — don't force one.
  const buttonType = asChild ? undefined : type;
  return (
    <Comp
      ref={ref as React.Ref<HTMLButtonElement>}
      type={buttonType}
      className={cx(
        "cq-btn",
        ghost && "cq-btn--ghost",
        accent && "cq-btn--accent",
        sm && "cq-btn--sm",
        className,
      )}
      {...rest}
    />
  );
});

export const IconBtn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function IconBtn({ className, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={cx("cq-icon-btn", className)} {...rest} />
  );
});
