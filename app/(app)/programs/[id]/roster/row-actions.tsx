"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { revokeInvite, removeLearnerFromProgram } from "./actions";

export function RevokeInviteButton({
  inviteId,
  programId,
  email,
}: {
  inviteId: string;
  programId: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Btn
      sm
      ghost
      disabled={pending}
      onClick={async () => {
        if (!confirm(`Revoke the pending invite for ${email}? They won't be able to use the link.`)) return;
        setPending(true);
        const res = await revokeInvite(inviteId, programId);
        setPending(false);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Invite revoked.");
          router.refresh();
        }
      }}
    >
      {pending ? "…" : "REVOKE"} <Icon name="x" />
    </Btn>
  );
}

export function RemoveLearnerButton({
  learnerUserId,
  programId,
  learnerName,
}: {
  learnerUserId: string;
  programId: string;
  learnerName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Btn
      sm
      ghost
      disabled={pending}
      onClick={async () => {
        if (
          !confirm(
            `Remove ${learnerName} from this Chatrail? Their conversations + grades stay in place; they just lose access to start new attempts.`,
          )
        )
          return;
        setPending(true);
        const res = await removeLearnerFromProgram(learnerUserId, programId);
        setPending(false);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Removed from Chatrail.");
          router.refresh();
        }
      }}
    >
      {pending ? "…" : "REMOVE"} <Icon name="trash" />
    </Btn>
  );
}
