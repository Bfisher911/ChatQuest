"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

interface ActionProps {
  notificationId?: string;
  hasUnread: boolean;
  markAllOnly?: boolean;
}

export function NotificationActions({ notificationId, hasUnread, markAllOnly }: ActionProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (markAllOnly) {
    return (
      <Btn
        sm
        ghost
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const res = await markAllNotificationsRead();
          setPending(false);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("All marked as read.");
            router.refresh();
          }
        }}
      >
        {pending ? "…" : "MARK ALL READ"} <Icon name="check" />
      </Btn>
    );
  }

  if (!notificationId || !hasUnread) return null;
  return (
    <Btn
      sm
      ghost
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await markNotificationRead(notificationId);
        setPending(false);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Marked read.");
          router.refresh();
        }
      }}
    >
      {pending ? "…" : "MARK READ"}
    </Btn>
  );
}
