import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { Eyebrow, Btn, Icon } from "@/components/brutalist";
import { ProgramsListView, type ProgramRow } from "./programs-list";

export const dynamic = "force-dynamic";

export default async function ProgramsListPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  const supabase = createClient();
  const { data: programs } = await supabase
    .from("programs")
    .select("id, title, description, status, default_model, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <Eyebrow>CHATRAILS</Eyebrow>
        <Btn sm asChild>
          <Link href="/programs/new">
            <Icon name="plus" /> NEW CHATRAIL
          </Link>
        </Btn>
      </div>
      <ProgramsListView programs={(programs ?? []) as ProgramRow[]} />
    </div>
  );
}
