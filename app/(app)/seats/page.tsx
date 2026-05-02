// Creator-facing seat management page.
// Shows the active plan's seat counts (instructor + learner), the learners
// currently assigned to seats, and a per-Chatrail breakdown of who's on it.

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRole } from "@/lib/auth/active-role";
import { getOrgPlan } from "@/lib/billing/gate";
import { Eyebrow, Frame, Btn, Chip, Icon } from "@/components/brutalist";

export const dynamic = "force-dynamic";

export default async function SeatsPage() {
  const session = await getActiveRole();
  if (!session) redirect("/login");
  if (!["instructor", "org_admin", "super_admin"].includes(session.activeRole)) {
    redirect("/dashboard");
  }
  const orgId = session.activeOrganizationId;
  if (!orgId) redirect("/dashboard");

  const supabase = createClient();
  const plan = await getOrgPlan(orgId);

  // Members + their roles.
  const { data: membersRaw } = await supabase
    .from("organization_members")
    .select("user_id, role, joined_at, user:users(id, email, full_name, display_name)")
    .eq("organization_id", orgId)
    .eq("is_active", true);
  type MemberRow = {
    user_id: string;
    role: string;
    joined_at: string;
    user: { id: string; email: string; full_name: string | null; display_name: string | null } | null;
  };
  const members = (membersRaw ?? []) as unknown as MemberRow[];

  const learners = members.filter((m) => m.role === "learner");
  const staff = members.filter((m) => m.role === "instructor" || m.role === "ta" || m.role === "org_admin");

  // Each learner's Chatrail assignments.
  const learnerIds = learners.map((m) => m.user_id);
  const { data: enrollmentsRaw } = await supabase
    .from("program_enrollments")
    .select("user_id, status, program:programs(id, title)")
    .in("user_id", learnerIds.length ? learnerIds : ["00000000-0000-0000-0000-000000000000"]);
  type EnrollRow = { user_id: string; status: string; program: { id: string; title: string } | null };
  const enrollments = (enrollmentsRaw ?? []) as unknown as EnrollRow[];

  // Programs in this org for the assignment dropdown.
  const { data: programsRaw } = await supabase
    .from("programs")
    .select("id, title, status")
    .eq("organization_id", orgId)
    .neq("status", "archived")
    .order("title");
  const programs = programsRaw ?? [];

  const learnerAssignments = new Map<string, EnrollRow[]>();
  for (const e of enrollments) {
    const arr = learnerAssignments.get(e.user_id) ?? [];
    arr.push(e);
    learnerAssignments.set(e.user_id, arr);
  }

  const learnerSeatsTotal = plan?.learner_seats ?? 0;
  const learnerSeatsUsed = learners.length;
  const learnerSeatsRemaining = Math.max(0, learnerSeatsTotal - learnerSeatsUsed);
  const instructorSeatsTotal = plan?.instructor_seats ?? 0;
  const instructorSeatsUsed = staff.length;
  const instructorSeatsRemaining = Math.max(0, instructorSeatsTotal - instructorSeatsUsed);

  return (
    <div className="cq-page" style={{ maxWidth: 1100 }}>
      <Eyebrow>SEATS</Eyebrow>
      <h1 className="cq-title-l" style={{ marginTop: 12, marginBottom: 24 }}>
        SEAT PROVISIONING.
      </h1>
      <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: 24 }}>
        Your plan ships a pool of learner + instructor seats. Each invite consumes one.
        When a learner accepts, they show up here — assign them to one or more Chatrails below.
      </p>

      <Frame style={{ padding: 24, marginBottom: 24 }}>
        <div className="cq-grid cq-grid--3" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          <SeatStat label="PLAN" value={(plan?.code ?? "free").toUpperCase()} />
          <SeatStat
            label="INSTRUCTOR SEATS"
            value={`${instructorSeatsUsed} / ${instructorSeatsTotal}`}
            sub={instructorSeatsRemaining === 0 ? "FULL — UPGRADE TO ADD MORE" : `${instructorSeatsRemaining} REMAINING`}
            warning={instructorSeatsRemaining === 0}
          />
          <SeatStat
            label="LEARNER SEATS"
            value={`${learnerSeatsUsed} / ${learnerSeatsTotal}`}
            sub={learnerSeatsRemaining === 0 ? "FULL — UPGRADE TO ADD MORE" : `${learnerSeatsRemaining} REMAINING`}
            warning={learnerSeatsRemaining === 0}
            last
          />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Btn sm asChild>
            <Link href="/org/billing">UPGRADE PLAN <Icon name="arrow" /></Link>
          </Btn>
          <Btn sm ghost asChild>
            <Link href="/programs">MANAGE CHATRAILS</Link>
          </Btn>
        </div>
      </Frame>

      <Eyebrow>LEARNERS · {learners.length}</Eyebrow>
      <Frame style={{ marginTop: 12, marginBottom: 24 }}>
        <table className="cq-table">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>NAME</th>
              <th>EMAIL</th>
              <th className="num">CHATRAILS</th>
              <th className="num">ASSIGN</th>
            </tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No learners yet. Invite from any Chatrail&apos;s <Link href="/programs" style={{ textDecoration: "underline" }}>Roster</Link> tab.
                </td>
              </tr>
            ) : (
              learners.map((m) => {
                const assignments = learnerAssignments.get(m.user_id) ?? [];
                return (
                  <tr key={m.user_id}>
                    <td style={{ fontWeight: 700 }}>
                      {m.user?.display_name ?? m.user?.full_name ?? "—"}
                    </td>
                    <td>{m.user?.email ?? "—"}</td>
                    <td className="num">
                      <div className="row" style={{ gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                        {assignments.length === 0 ? (
                          <span className="cq-mono" style={{ color: "var(--muted)", fontSize: 11 }}>
                            NONE
                          </span>
                        ) : (
                          assignments.map((a, i) => (
                            <Chip key={i} ghost>
                              {a.program?.title ?? "?"}
                            </Chip>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="num">
                      {programs.length > 0 ? (
                        <AssignForm
                          learnerId={m.user_id}
                          programs={programs}
                          alreadyAssigned={new Set(assignments.map((a) => a.program?.id).filter(Boolean) as string[])}
                        />
                      ) : (
                        <span className="cq-mono" style={{ fontSize: 11 }}>NO CHATRAILS</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Frame>

      <Eyebrow>INSTRUCTOR SEATS · {staff.length}</Eyebrow>
      <Frame style={{ marginTop: 12 }}>
        <table className="cq-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EMAIL</th>
              <th className="num">ROLE</th>
              <th className="num">JOINED</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>None.</td>
              </tr>
            ) : (
              staff.map((m) => (
                <tr key={m.user_id}>
                  <td style={{ fontWeight: 700 }}>{m.user?.display_name ?? m.user?.full_name ?? "—"}</td>
                  <td>{m.user?.email ?? "—"}</td>
                  <td className="num"><Chip ghost>{m.role.toUpperCase()}</Chip></td>
                  <td className="num">{new Date(m.joined_at).toISOString().slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Frame>
    </div>
  );
}

function SeatStat({
  label,
  value,
  sub,
  warning,
  last,
}: {
  label: string;
  value: string;
  sub?: string;
  warning?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRight: last ? "0" : "var(--hair) solid var(--ink)",
        background: warning ? "var(--soft)" : "var(--paper)",
      }}
    >
      <div className="cq-mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
        {label}
      </div>
      <div className="cq-title-l" style={{ fontSize: 32 }}>
        {value}
      </div>
      {sub ? (
        <div
          className="cq-mono"
          style={{ fontSize: 11, marginTop: 4, color: warning ? "var(--ink)" : "var(--muted)" }}
        >
          {warning ? "■ " : ""}
          {sub}
        </div>
      ) : null}
    </div>
  );
}

interface AssignFormProps {
  learnerId: string;
  programs: { id: string; title: string; status: string | null }[];
  alreadyAssigned: Set<string>;
}

import { AssignToChatrailButton } from "./assign-button";

function AssignForm({ learnerId, programs, alreadyAssigned }: AssignFormProps) {
  const available = programs.filter((p) => !alreadyAssigned.has(p.id));
  if (available.length === 0) {
    return <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>ALL ASSIGNED</span>;
  }
  return <AssignToChatrailButton learnerId={learnerId} programs={available} />;
}
