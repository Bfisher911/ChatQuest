"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";
import { toast } from "sonner";
import { updateOrganization } from "../actions";

interface Props {
  org: {
    id: string;
    name: string;
    slug: string;
    orgType: "school" | "company" | "training" | "other";
  };
}

export function OrgSettingsForm({ org }: Props) {
  const router = useRouter();
  const [name, setName] = React.useState(org.name);
  const [slug, setSlug] = React.useState(org.slug);
  const [orgType, setOrgType] = React.useState(org.orgType);
  const [pending, setPending] = React.useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await updateOrganization({
      organizationId: org.id,
      name,
      slug,
      orgType,
    });
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Org saved.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <div className="cq-field">
        <label htmlFor="orgName">Organization name</label>
        <input
          id="orgName"
          className="cq-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
        />
      </div>
      <div className="cq-grid cq-grid--2" style={{ gap: 12 }}>
        <div className="cq-field">
          <label htmlFor="orgSlug">Slug (used in URLs)</label>
          <input
            id="orgSlug"
            className="cq-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9-]+"
            minLength={2}
            maxLength={60}
          />
        </div>
        <div className="cq-field">
          <label htmlFor="orgType">Type</label>
          <select
            id="orgType"
            className="cq-select"
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as Props["org"]["orgType"])}
          >
            <option value="school">School / University</option>
            <option value="company">Company</option>
            <option value="training">Training / SME</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <Btn type="submit" disabled={pending}>
          {pending ? "SAVING…" : "SAVE ORG"} <Icon name="check" />
        </Btn>
      </div>
    </form>
  );
}
