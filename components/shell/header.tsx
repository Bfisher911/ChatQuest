"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconBtn, Icon } from "@/components/brutalist";
import { cx } from "@/lib/utils/cx";
import type { UserRole } from "@/lib/db/types";
import { signOut } from "@/app/(auth)/actions";

export interface HeaderProps {
  userEmail: string;
  displayName: string;
  activeRole: UserRole;
  memberships: { organizationId: string; organizationName: string; role: UserRole }[];
  isSuperAdmin: boolean;
  unreadNotifications?: number;
}

const ROLE_NAVS: Record<UserRole, { label: string; href: string }[]> = {
  instructor: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Chatrails", href: "/programs" },
    { label: "Seats", href: "/seats" },
    { label: "Knowledge", href: "/kb" },
    { label: "Rubrics", href: "/rubrics" },
    { label: "Org", href: "/org/settings" },
  ],
  ta: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Chatrails", href: "/programs" },
  ],
  learner: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "My Chatrails", href: "/learn" },
    { label: "Certificates", href: "/learn/certificates" },
  ],
  org_admin: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Chatrails", href: "/programs" },
    { label: "Seats", href: "/seats" },
    { label: "Members", href: "/org/members" },
    { label: "Org", href: "/org/settings" },
    { label: "Billing", href: "/org/billing" },
  ],
  super_admin: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Orgs", href: "/admin/orgs" },
    { label: "Users", href: "/admin/users" },
    { label: "Subscriptions", href: "/admin/subscriptions" },
    { label: "Usage", href: "/admin/usage" },
  ],
};

export function Header({
  displayName,
  activeRole,
  memberships,
  isSuperAdmin,
  unreadNotifications = 0,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = ROLE_NAVS[activeRole] ?? ROLE_NAVS.learner;

  const availableRoles: UserRole[] = React.useMemo(() => {
    const all = new Set<UserRole>(memberships.map((m) => m.role));
    if (isSuperAdmin) all.add("super_admin");
    return Array.from(all);
  }, [memberships, isSuperAdmin]);

  function switchRole(next: UserRole) {
    document.cookie = `cq_role=${next}; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
    router.refresh();
  }

  return (
    <header className="cq-header">
      <div className="row" style={{ gap: 28 }}>
        <Link className="cq-logo" href="/dashboard">
          <span className="cq-logo-mark">CHAT</span>
          <span className="cq-logo-quest">RAIL</span>
        </Link>
        <nav className="cq-nav" style={{ marginLeft: 16 }}>
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link key={l.href} href={l.href} className={cx(active && "is-active")}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="row cq-nav-tools">
        {availableRoles.length > 1 ? (
          <select
            value={activeRole}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="cq-select"
            style={{ width: "auto", padding: "6px 8px", fontSize: 11, textTransform: "uppercase" }}
            aria-label="Switch role"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        ) : null}
        <Link
          href="/notifications"
          title={
            unreadNotifications > 0
              ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}`
              : "Notifications"
          }
          aria-label="Notifications"
          className="cq-icon-btn"
          style={{ position: "relative" }}
        >
          <Icon name="bell" />
          {unreadNotifications > 0 ? (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                padding: "0 4px",
                borderRadius: 0,
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                lineHeight: "18px",
                textAlign: "center",
                border: "2px solid var(--paper)",
              }}
            >
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          ) : null}
        </Link>
        <Link
          href="/account"
          title={`Signed in as ${displayName} — open account`}
          aria-label="Account"
          className="cq-icon-btn"
        >
          <Icon name="user" />
        </Link>
        <IconBtn
          title="Sign out"
          aria-label="Sign out"
          onClick={async () => {
            await signOut();
          }}
        >
          <Icon name="logout" />
        </IconBtn>
        <IconBtn
          style={{ width: "auto", padding: "0 10px", fontFamily: "var(--font-pixel)", fontSize: 10 }}
          title="Language"
          aria-label="Language"
        >
          EN
        </IconBtn>
      </div>
    </header>
  );
}
