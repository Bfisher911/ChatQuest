import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Frame, Btn, Icon, Chip } from "@/components/brutalist";
import { NotificationActions } from "./row-actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  grade_returned: "GRADE",
  cert_awarded: "CERT",
  invite_received: "INVITE",
  comment_added: "COMMENT",
  other: "INFO",
};

export default async function NotificationsPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, is_read, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const items = rows ?? [];
  const unreadCount = items.filter((r) => !r.is_read).length;

  return (
    <div className="cq-page" style={{ maxWidth: 880 }}>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <Eyebrow>NOTIFICATIONS</Eyebrow>
        {unreadCount > 0 ? (
          <NotificationActions hasUnread={true} markAllOnly />
        ) : null}
      </div>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 8 }}>
        YOUR INBOX.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        {unreadCount > 0
          ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
          : "You're all caught up."}
      </p>

      {items.length === 0 ? (
        <Frame style={{ padding: 32, textAlign: "center" }}>
          <Eyebrow>NOTHING YET</Eyebrow>
          <div className="cq-title-m" style={{ marginTop: 12, marginBottom: 16 }}>
            NO NOTIFICATIONS.
          </div>
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 20 }}>
            You&apos;ll see grade returns, cert awards, invites, and instructor
            comments here as they happen.
          </p>
          <Btn asChild>
            <Link href="/dashboard">
              DASHBOARD <Icon name="arrow" />
            </Link>
          </Btn>
        </Frame>
      ) : (
        <Frame style={{ padding: 0 }}>
          {items.map((n, i) => (
            <div
              key={n.id}
              style={{
                padding: 16,
                borderBottom: i < items.length - 1 ? "var(--hair) solid var(--ink)" : "0",
                background: n.is_read ? "var(--paper)" : "var(--soft)",
              }}
            >
              <div className="row-between" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    {!n.is_read ? <Chip>NEW</Chip> : null}
                    <Chip ghost>{KIND_LABEL[n.kind] ?? n.kind.toUpperCase()}</Chip>
                    <span
                      className="cq-mono"
                      style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}
                    >
                      {new Date(n.created_at).toISOString().replace("T", " ").slice(0, 16)}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16 }}>
                    {n.title}
                  </div>
                  {n.body ? (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--muted)",
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {n.body}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {n.href ? (
                  <Btn sm asChild>
                    <Link href={n.href}>
                      OPEN <Icon name="arrow" />
                    </Link>
                  </Btn>
                ) : null}
                <NotificationActions notificationId={n.id} hasUnread={!n.is_read} />
              </div>
            </div>
          ))}
        </Frame>
      )}
    </div>
  );
}
