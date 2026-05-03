"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { duplicateProgram } from "../actions";

export function DuplicateChatrailButton({ programId }: { programId: string }) {
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
            "Duplicate this Chatrail? Nodes, edges, chatbot configs, rules, and certificate definitions are copied. Learners, conversations, grades, and KB files are not.",
          )
        )
          return;
        setPending(true);
        const res = await duplicateProgram(programId);
        setPending(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Duplicated.");
        router.push(`/programs/${res.programId}`);
      }}
    >
      {pending ? "DUPLICATING…" : "DUPLICATE"} <Icon name="grid" />
    </Btn>
  );
}
