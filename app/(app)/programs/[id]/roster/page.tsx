import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Chip, Frame } from "@/components/brutalist";
import { InviteForm } from "./invite-form";
import { CsvImport } from "./csv-import";
import { RevokeInviteButton, RemoveLearnerButton } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, title, organization_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!program) notFound();

  const { data: enrollments } = await supabase
    .from("program_enrollments")
    .select("user_id, enrolled_at, status, user:users(email, full_name, display_name)")
    .eq("program_id", params.id);

  type Row = { user_id: string; enrolled_at: string; status: string; user: { email: string; full_name: string | null; display_name: string | null } | null };
  const learners = (enrollments ?? []) as unknown as Row[];

  const { data: instructors } = await supabase
    .from("program_instructors")
    .select("user_id, capacity, user:users(email, full_name, display_name)")
    .eq("program_id", params.id);
  type IRow = { user_id: string; capacity: string; user: { email: string; full_name: string | null; display_name: string | null } | null };
  const inst = (instructors ?? []) as unknown as IRow[];

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, status, expires_at, created_at")
    .eq("program_id", params.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <Eyebrow>ROSTER</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        {program.title.toUpperCase()}
      </h1>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <Eyebrow>INVITE</Eyebrow>
        <div style={{ marginTop: 12 }}>
          <InviteForm programId={program.id} />
        </div>
        <div style={{ marginTop: 24 }}>
          <Eyebrow>BULK CSV</Eyebrow>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: "8px 0 12px" }}>
            One email per line. First column is the email; other columns are ignored.
          </p>
          <CsvImport programId={program.id} />
        </div>
      </Frame>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <Eyebrow>LEARNERS · {learners.length}</Eyebrow>
      </div>
      <div className="cq-frame" style={{ marginBottom: 24 }}>
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">STATUS</th>
              <th className="num">ENROLLED</th>
            </tr>
          </thead>
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">STATUS</th>
              <th className="num">ENROLLED</th>
              <th className="num">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No learners yet.
                </td>
              </tr>
            ) : (
              learners.map((l) => (
                <tr key={l.user_id}>
                  <td>{l.user?.display_name ?? l.user?.full_name ?? "—"}</td>
                  <td>{l.user?.email ?? "—"}</td>
                  <td className="num">
                    <Chip ghost>{l.status.toUpperCase()}</Chip>
                  </td>
                  <td className="num">{new Date(l.enrolled_at).toISOString().slice(0, 10)}</td>
                  <td className="num">
                    <RemoveLearnerButton
                      learnerUserId={l.user_id}
                      programId={program.id}
                      learnerName={l.user?.display_name ?? l.user?.full_name ?? l.user?.email ?? "this learner"}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Eyebrow>INSTRUCTORS · {inst.length}</Eyebrow>
      <div className="cq-frame" style={{ marginTop: 12, marginBottom: 24 }}>
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">CAPACITY</th>
            </tr>
          </thead>
          <tbody>
            {inst.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                  None.
                </td>
              </tr>
            ) : (
              inst.map((i) => (
                <tr key={i.user_id}>
                  <td>{i.user?.display_name ?? i.user?.full_name ?? "—"}</td>
                  <td>{i.user?.email ?? "—"}</td>
                  <td className="num">
                    <Chip>{i.capacity.toUpperCase()}</Chip>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(invites ?? []).length > 0 ? (
        <>
          <Eyebrow>PENDING INVITES · {invites?.length}</Eyebrow>
          <div className="cq-frame" style={{ marginTop: 12 }}>
            <table className="cq-table">
              <thead>
                <tr>
                  <th>EMAIL</th>
                  <th className="num">ROLE</th>
                  <th className="num">EXPIRES</th>
                  <th className="num">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(invites ?? []).map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td className="num">
                      <Chip ghost>{inv.role.toUpperCase()}</Chip>
                    </td>
                    <td className="num">{new Date(inv.expires_at).toISOString().slice(0, 10)}</td>
                    <td className="num">
                      <RevokeInviteButton inviteId={inv.id} programId={program.id} email={inv.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
