"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { inviteCsv } from "./actions";
import { toast } from "sonner";

export function CsvImport({ programId }: { programId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("programId", programId);
    const res = await inviteCsv(fd);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${res.added} learner(s). ${res.errors} error(s).`);
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <textarea
        name="csv"
        className="cq-textarea"
        placeholder={"ada@example.edu\nmarcus@example.edu\npriya@example.edu"}
        rows={5}
        required
      />
      <div>
        <Btn type="submit" ghost disabled={pending}>
          {pending ? "IMPORTING…" : "IMPORT CSV"} <Icon name="upload" />
        </Btn>
      </div>
    </form>
  );
}
