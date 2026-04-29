import * as React from "react";
import Link from "next/link";
import { cx } from "@/lib/utils/cx";
import { bin } from "@/lib/utils/binary";

export interface CassetteProps {
  index?: number | string;
  indexWidth?: number;
  title: string;
  meta?: React.ReactNode;
  corner?: React.ReactNode;
  children?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  small?: boolean;
  staticCard?: boolean;
  className?: string;
}

/**
 * The "cassette" card from the prototype — frame border, hover translate,
 * binary index, uppercase title. Renders as <Link> when `href` is given.
 */
export function Cassette({
  index,
  indexWidth = 8,
  title,
  meta,
  corner,
  children,
  href,
  onClick,
  small,
  staticCard,
  className,
}: CassetteProps) {
  const formattedIdx =
    typeof index === "number" ? bin(index, indexWidth) : index;
  const body = (
    <>
      {corner ? <div className="cq-cassette__corner">{corner}</div> : null}
      {formattedIdx !== undefined ? (
        <div className="cq-cassette__index">{formattedIdx}</div>
      ) : null}
      <h3 className="cq-cassette__title">{title}</h3>
      {meta ? <div className="cq-cassette__meta">{meta}</div> : null}
      {children}
    </>
  );
  const cls = cx(
    "cq-cassette",
    small && "cq-cassette--sm",
    staticCard && "cq-cassette--static",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={{ textAlign: "left" }}>
        {body}
      </button>
    );
  }
  return <div className={cx(cls, !staticCard && "cq-cassette--static")}>{body}</div>;
}

export interface CassetteStatsProps {
  items: { v: React.ReactNode; k: string }[];
}

export function CassetteStats({ items }: CassetteStatsProps) {
  return (
    <div className="cq-cassette__stats">
      {items.map((item, i) => (
        <div
          key={i}
          className="cq-cassette__stat"
          style={i > 0 ? { paddingLeft: 12 } : undefined}
        >
          <div className="v">{item.v}</div>
          <div className="k">{item.k}</div>
        </div>
      ))}
    </div>
  );
}

export function CassetteChips({ children }: { children: React.ReactNode }) {
  return <div className="cq-cassette__chips">{children}</div>;
}
