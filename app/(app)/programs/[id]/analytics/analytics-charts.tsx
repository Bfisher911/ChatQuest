"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { Eyebrow } from "@/components/brutalist";

interface NodeStat {
  node_id: string;
  title: string;
  avg: number;
  count: number;
  type: string;
}

export function AnalyticsCharts({
  tokenSeries,
  nodeStats,
}: {
  tokenSeries: { day: string; tokens: number }[];
  nodeStats: NodeStat[];
}) {
  return (
    <div className="cq-grid cq-grid--2" style={{ gap: 24, marginTop: 16 }}>
      <div>
        <Eyebrow>TOKENS / DAY</Eyebrow>
        <div style={{ width: "100%", height: 220, marginTop: 8 }}>
          <ResponsiveContainer>
            <LineChart data={tokenSeries} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#000" strokeDasharray="0" strokeWidth={0.5} opacity={0.15} />
              <XAxis dataKey="day" stroke="#000" tick={{ fontFamily: "var(--font-mono)", fontSize: 10 }} />
              <YAxis stroke="#000" tick={{ fontFamily: "var(--font-mono)", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2px solid #000",
                  borderRadius: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="tokens"
                stroke="#000"
                strokeWidth={2}
                dot={{ stroke: "#000", strokeWidth: 2, r: 3, fill: "#fff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <Eyebrow>AVG SCORE BY NODE</Eyebrow>
        <div style={{ width: "100%", height: 220, marginTop: 8 }}>
          <ResponsiveContainer>
            <BarChart data={nodeStats.map((n) => ({ ...n, label: n.title.slice(0, 12) }))} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#000" strokeDasharray="0" strokeWidth={0.5} opacity={0.15} />
              <XAxis dataKey="label" stroke="#000" tick={{ fontFamily: "var(--font-mono)", fontSize: 10 }} />
              <YAxis stroke="#000" domain={[0, 100]} tick={{ fontFamily: "var(--font-mono)", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2px solid #000",
                  borderRadius: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="avg" fill="#000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
