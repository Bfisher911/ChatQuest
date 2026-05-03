"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { updateMemberRole, deactivateMember, reactivateMember } from "../actions";

interface MemberRowProps {
  organizationId: string;
  member: {
    id: string;
    role: "org_admin" | "instructor" | "ta" | "learner";
    joinedAt: string;
    isActive: boolean;
    name: string;
    email: string;
    isSelf: boolean;
  };
  canEdit: boolean;
}

const ROLE_OPTIONS: { value: MemberRowProps["member"]["role"]; label: string }[] = [
  { value: "org_admin", label: "Org admin" },
  { value: "instructor", label: "Instructor" },
  { value: "ta", label: "TA" },
  { value: "learner", label: "Learner" },
];

export function MemberRow({ organizationId, member, canEdit }: MemberRowProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [role, setRole] = React.useState(member.role);

  async function changeRole(next: MemberRowProps["member"]["role"]) {
    if (next === role) return;
    setPending(true);
    const res = await updateMemberRole({
      organizationId,
      memberId: member.id,
      role: next,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRole(next);
    toast.success(`Role updated to ${next.replace("_", " ")}.`);
    router.refresh();
  }

  async function toggleActive() {
    if (member.isSelf && member.isActive) {
      toast.error("You can't deactivate yourself.");
      return;
    }
    const action = member.isActive ? deactivateMember : reactivateMember;
    const verb = member.isActive ? "Deactivate" : "Reactivate";
    if (!confirm(`${verb} ${member.name}?`)) return;
    setPending(true);
    const res = await action(member.id, organizationId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${verb}d.`);
    router.refresh();
  }

  return (
    <tr style={{ opacity: member.isActive ? 1 : 0.55 }}>
      <td>
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{member.name}</span>
        {member.isSelf ? <Chip ghost>YOU</Chip> : null}
      </td>
      <td>{member.email}</td>
      <td className="num">
        {canEdit && !member.isSelf ? (
          <select
            className="cq-select"
            value={role}
            disabled={pending}
            onChange={(e) => void changeRole(e.target.value as MemberRowProps["member"]["role"])}
            style={{ width: 140, fontSize: 12 }}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <Chip ghost>{role.replace("_", " ").toUpperCase()}</Chip>
        )}
      </td>
      <td className="num">{new Date(member.joinedAt).toISOString().slice(0, 10)}</td>
      {canEdit ? (
        <td className="num">
          {member.isSelf ? (
            <span className="cq-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              SELF
            </span>
          ) : (
            <Btn sm ghost disabled={pending} onClick={toggleActive}>
              {pending ? "…" : member.isActive ? "DEACTIVATE" : "REACTIVATE"}{" "}
              <Icon name={member.isActive ? "x" : "check"} />
            </Btn>
          )}
        </td>
      ) : null}
    </tr>
  );
}
