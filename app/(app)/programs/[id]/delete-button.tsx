"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Frame, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { deleteProgram } from "../actions";

/**
 * Two-stage destructive delete: button → inline confirm panel that requires
 * typing the exact Chatrail title before the DELETE PERMANENTLY button enables.
 *
 * Lives at the bottom of the overview, separated from the main controls so it
 * can't be triggered by adjacent clicks.
 */
export function DeleteChatrailButton({
  programId,
  programTitle,
}: {
  programId: string;
  programTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const matches = typed.trim() === programTitle.trim();

  if (!open) {
    return (
      <Btn
        sm
        ghost
        onClick={() => setOpen(true)}
        title="Permanently delete this Chatrail and all its data"
      >
        <Icon name="trash" /> DELETE CHATRAIL
      </Btn>
    );
  }

  return (
    <Frame
      style={{
        padding: 16,
        marginTop: 12,
        background: "var(--soft)",
        maxWidth: 560,
      }}
    >
      <div className="cq-mono" style={{ fontSize: 11, marginBottom: 8 }}>
        ■ PERMANENT DELETE
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        This deletes the Chatrail, every node, every conversation, every grade,
        every certificate award, and all uploaded files. <strong>It cannot be undone.</strong>
        {" "}
        To confirm, type the title exactly:
      </div>
      <div className="cq-mono" style={{ fontSize: 12, marginBottom: 6, color: "var(--muted)" }}>
        {programTitle}
      </div>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="Type the title to confirm"
        autoFocus
        disabled={pending}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          border: "var(--hair) solid var(--ink)",
          background: "var(--paper)",
          outline: matches ? "2px solid var(--ink)" : "none",
        }}
      />
      <div className="row" style={{ gap: 8 }}>
        <Btn
          sm
          accent
          disabled={!matches || pending}
          onClick={async () => {
            setPending(true);
            const res = await deleteProgram({ programId, confirmTitle: typed });
            setPending(false);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success("Chatrail deleted.");
            router.push("/programs");
            router.refresh();
          }}
        >
          {pending ? "DELETING…" : "DELETE PERMANENTLY"}
        </Btn>
        <Btn
          sm
          ghost
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
        >
          CANCEL
        </Btn>
      </div>
    </Frame>
  );
}
