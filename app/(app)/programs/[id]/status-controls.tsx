"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { setProgramStatus } from "@/lib/path/actions";

type Status = "draft" | "published" | "archived";

export function ProgramStatusControls({
  programId,
  status,
  nodeCount,
}: {
  programId: string;
  status: Status;
  nodeCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function go(next: Status, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setPending(true);
    const res = await setProgramStatus({ programId, status: next });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Chatrail is now ${next}.`);
    router.refresh();
  }

  return (
    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {status === "draft" ? (
        <>
          <Chip ghost>DRAFT</Chip>
          <Btn
            sm
            disabled={pending || nodeCount === 0}
            onClick={() =>
              go(
                "published",
                nodeCount === 0
                  ? undefined
                  : `Publish this Chatrail? Enrolled learners will be able to start it immediately.`,
              )
            }
            title={nodeCount === 0 ? "Add at least one node before publishing" : undefined}
          >
            {pending ? "…" : "PUBLISH"} <Icon name="arrow" />
          </Btn>
        </>
      ) : status === "published" ? (
        <>
          <Chip>PUBLISHED</Chip>
          <Btn
            sm
            ghost
            disabled={pending}
            onClick={() =>
              go("draft", "Unpublish this Chatrail? Learners will lose access until you republish.")
            }
          >
            {pending ? "…" : "UNPUBLISH"}
          </Btn>
          <Btn
            sm
            ghost
            disabled={pending}
            onClick={() =>
              go(
                "archived",
                "Archive this Chatrail? Learners lose access. You can keep grading existing submissions but no new attempts.",
              )
            }
          >
            <Icon name="lock" /> ARCHIVE
          </Btn>
        </>
      ) : (
        <>
          <Chip ghost>ARCHIVED</Chip>
          <Btn
            sm
            ghost
            disabled={pending}
            onClick={() =>
              go("draft", "Restore this Chatrail to draft? You can publish it again afterwards.")
            }
          >
            {pending ? "…" : "RESTORE TO DRAFT"}
          </Btn>
        </>
      )}
    </div>
  );
}
