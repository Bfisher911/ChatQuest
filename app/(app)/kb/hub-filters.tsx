"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn, Icon } from "@/components/brutalist";

export function KbHubFilters({
  initialQuery,
  initialStatus,
  initialCollection,
  collections,
}: {
  initialQuery: string;
  initialStatus: string;
  initialCollection: string;
  collections: { id: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(initialQuery);
  const [status, setStatus] = React.useState(initialStatus);
  const [collection, setCollection] = React.useState(initialCollection);

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    if (status) next.set("status", status);
    else next.delete("status");
    if (collection) next.set("collection", collection);
    else next.delete("collection");
    router.push(`/kb${next.toString() ? `?${next.toString()}` : ""}`);
  }

  function clearAll() {
    setQ("");
    setStatus("");
    setCollection("");
    router.push("/kb");
  }

  const hasFilters = !!q || !!status || !!collection;

  return (
    <form
      onSubmit={apply}
      className="row"
      style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 4 }}
    >
      <div className="cq-field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
        <label htmlFor="kb-q">Filename</label>
        <input
          id="kb-q"
          className="cq-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="asilomar.pdf"
        />
      </div>
      <div className="cq-field" style={{ width: 200, marginBottom: 0 }}>
        <label htmlFor="kb-status">Status</label>
        <select
          id="kb-status"
          className="cq-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="indexed">Indexed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="cq-field" style={{ width: 280, marginBottom: 0 }}>
        <label htmlFor="kb-collection">Collection</label>
        <select
          id="kb-collection"
          className="cq-select"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <Btn sm type="submit">
        FILTER <Icon name="search" />
      </Btn>
      {hasFilters ? (
        <Btn sm ghost type="button" onClick={clearAll}>
          CLEAR
        </Btn>
      ) : null}
    </form>
  );
}
