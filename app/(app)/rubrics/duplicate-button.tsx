"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { duplicateRubric } from "./actions";

export function DuplicateRubricButton({ rubricId }: { rubricId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Btn
      sm
      ghost
      disabled={pending}
      onClick={async (e) => {
        // Prevent the click from bubbling up to the surrounding cassette link.
        e.preventDefault();
        e.stopPropagation();
        setPending(true);
        const res = await duplicateRubric(rubricId);
        setPending(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Rubric duplicated.");
        router.push(`/rubrics/${res.rubricId}`);
        router.refresh();
      }}
    >
      {pending ? "DUPLICATING…" : "DUPLICATE"} <Icon name="grid" />
    </Btn>
  );
}
