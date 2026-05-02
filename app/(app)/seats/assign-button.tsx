"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { assignLearnerToChatrail } from "./actions";

export function AssignToChatrailButton({
  learnerId,
  programs,
}: {
  learnerId: string;
  programs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [selected, setSelected] = React.useState(programs[0]?.id ?? "");

  async function go() {
    if (!selected) return;
    setPending(true);
    const res = await assignLearnerToChatrail(learnerId, selected);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Assigned.");
    router.refresh();
  }

  return (
    <div className="row" style={{ gap: 6, justifyContent: "center" }}>
      <select
        className="cq-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ width: 180, fontSize: 12 }}
        disabled={pending}
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <Btn sm onClick={go} disabled={pending || !selected}>
        {pending ? "…" : "ASSIGN"} <Icon name="arrow" />
      </Btn>
    </div>
  );
}
