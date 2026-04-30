import * as React from "react";
import { Eyebrow } from "@/components/brutalist";
import { CassetteSkeleton } from "@/components/brutalist/skeleton";

export default function LearnLoading() {
  return (
    <div className="cq-page">
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>LOADING</Eyebrow>
      </div>
      <div className="cq-grid cq-grid--3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CassetteSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
