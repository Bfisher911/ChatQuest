import * as React from "react";
import Link from "next/link";
import { Eyebrow, Btn, Icon, Frame } from "@/components/brutalist";

export interface ChecklistItemSpec {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
}

/**
 * 5-step "first program checklist" shown on the instructor dashboard until
 * every step is completed. Pure presentational — server-side computes which
 * steps are done and passes them in.
 */
export function OnboardingChecklist({ items }: { items: ChecklistItemSpec[] }) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  if (done === total) return null; // hide once everything is checked

  const nextStep = items.find((i) => !i.done);

  return (
    <Frame style={{ padding: 24, marginBottom: 24, position: "relative" }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <Eyebrow>FIRST-RUN CHECKLIST</Eyebrow>
        <div className="cq-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {done} / {total} COMPLETE
        </div>
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={item.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: i < items.length - 1 ? "var(--hair) solid var(--ink)" : "0",
              opacity: item.done ? 0.55 : 1,
            }}
          >
            <span
              className={item.done ? "cq-square" : "cq-square cq-square--hollow"}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 9,
                letterSpacing: "0.05em",
                width: 28,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                flex: 1,
                textDecoration: item.done ? "line-through" : "none",
              }}
            >
              {item.label}
            </span>
            {!item.done && item.href ? (
              <Btn sm asChild>
                <Link href={item.href}>
                  {item.cta ?? "GO"} <Icon name="arrow" />
                </Link>
              </Btn>
            ) : item.done ? (
              <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <Icon name="check" size={12} /> DONE
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {nextStep && nextStep.href ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
          NEXT: {nextStep.label}
        </p>
      ) : null}
    </Frame>
  );
}
