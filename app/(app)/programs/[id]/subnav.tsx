"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Chip } from "@/components/brutalist";
import { cx } from "@/lib/utils/cx";

const TABS = [
  { label: "Overview", suffix: "" },
  { label: "Builder", suffix: "/builder" },
  { label: "Knowledge", suffix: "/kb" },
  { label: "Roster", suffix: "/roster" },
  { label: "Gradebook", suffix: "/gradebook" },
  { label: "Settings", suffix: "/settings" },
];

export function ProgramSubnav({ programId, status }: { programId: string; status: string }) {
  const pathname = usePathname();
  return (
    <div className="row" style={{ gap: 16, marginTop: 12, alignItems: "center" }}>
      <Chip ghost>{status?.toUpperCase()}</Chip>
      <nav className="cq-nav" style={{ gap: 16 }}>
        {TABS.map((t) => {
          const href = `/programs/${programId}${t.suffix}`;
          const active =
            t.suffix === ""
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={t.label} href={href} className={cx(active && "is-active")}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
