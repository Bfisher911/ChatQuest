"use client";

import * as React from "react";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";

export function CheckoutButton({
  planCode,
  scope = "org",
  portalMode,
  children,
}: {
  planCode?: string;
  scope?: "org" | "user";
  portalMode?: boolean;
  children: React.ReactNode;
}) {
  const [pending, setPending] = React.useState(false);
  async function go() {
    setPending(true);
    try {
      const url = portalMode ? "/api/stripe/portal" : "/api/stripe/checkout";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: portalMode ? "{}" : JSON.stringify({ planCode, scope }),
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        toast.error(j.error || "Stripe request failed");
        return;
      }
      window.location.href = j.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }
  return (
    <Btn sm onClick={go} disabled={pending}>
      {pending ? "OPENING…" : children} <Icon name="arrow" />
    </Btn>
  );
}
