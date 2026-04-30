import * as React from "react";
import { Eyebrow } from "@/components/brutalist";
import { CassetteSkeleton, Skeleton } from "@/components/brutalist/skeleton";

export default function DashboardLoading() {
  return (
    <div className="cq-page">
      <div className="cq-frame" style={{ padding: 28, marginBottom: 24 }}>
        <Skeleton width={140} height={14} />
        <div style={{ height: 12 }} />
        <Skeleton width="60%" height={48} />
        <div style={{ height: 24 }} />
        <div className="cq-grid cq-grid--4" style={{ gap: 0, border: "var(--hair) solid var(--ink)" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{ padding: 18, borderRight: i < 3 ? "var(--hair) solid var(--ink)" : "0" }}
            >
              <Skeleton width={80} height={11} />
              <div style={{ height: 8 }} />
              <Skeleton width={60} height={36} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>LOADING</Eyebrow>
      </div>
      <div className="cq-grid cq-grid--3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CassetteSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
