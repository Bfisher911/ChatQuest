"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn, Chip, Eyebrow, Icon } from "@/components/brutalist";
import { bin } from "@/lib/utils/binary";
import { markNodeComplete } from "@/lib/path/actions";
import { toast } from "sonner";

interface Slide {
  title: string;
  body: string;
  image_url?: string;
}

export interface SlidesViewerProps {
  programId: string;
  nodeId: string;
  title: string;
  slides: Slide[];
  alreadyComplete: boolean;
}

/**
 * Brutalist slide deck — black borders, monospace counter, prev/next chevrons.
 * Learners must reach the last slide before "MARK COMPLETE" enables. Keeps a
 * dot strip + arrow keys for navigation.
 */
export function SlidesViewer({
  programId,
  nodeId,
  title,
  slides,
  alreadyComplete,
}: SlidesViewerProps) {
  const router = useRouter();
  const [idx, setIdx] = React.useState(0);
  const [reached, setReached] = React.useState(0);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(alreadyComplete);

  React.useEffect(() => {
    setReached((r) => Math.max(r, idx));
  }, [idx]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setIdx((i) => Math.min(slides.length - 1, i + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div className="cq-page" style={{ maxWidth: 760 }}>
        <Eyebrow>SLIDES</Eyebrow>
        <h1 className="cq-title-l" style={{ marginTop: 12 }}>{title.toUpperCase()}</h1>
        <p style={{ fontFamily: "var(--font-mono)", marginTop: 12, color: "var(--muted)" }}>
          Your instructor hasn&apos;t added any slides to this node yet.
        </p>
      </div>
    );
  }

  const slide = slides[idx];
  const canComplete = reached >= slides.length - 1;

  async function complete() {
    if (!canComplete) {
      toast.error("Reach the last slide first.");
      return;
    }
    setPending(true);
    const res = await markNodeComplete(programId, nodeId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Marked complete.");
    setDone(true);
    router.refresh();
  }

  return (
    <div className="cq-page" style={{ maxWidth: 960 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Btn sm ghost asChild>
          <Link href={`/learn/${programId}`}>
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> JOURNEY
          </Link>
        </Btn>
        <Chip>SLIDES</Chip>
        {done ? <Chip ghost>DONE</Chip> : null}
        <span className="cq-mono" style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {bin(idx + 1, 4)} / {bin(slides.length, 4)}
        </span>
      </div>

      <h1 className="cq-title-l" style={{ marginBottom: 16 }}>
        {title.toUpperCase()}
      </h1>

      {/* Deck */}
      <div
        style={{
          border: "var(--frame) solid var(--ink)",
          padding: 36,
          minHeight: 420,
          display: "flex",
          flexDirection: "column",
          background: "var(--paper)",
        }}
      >
        <div
          className="cq-mono"
          style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16, letterSpacing: "0.06em" }}
        >
          ■ SLIDE {String(idx + 1).padStart(2, "0")} OF {String(slides.length).padStart(2, "0")}
        </div>
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 800,
            fontSize: 40,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            margin: 0,
            marginBottom: 24,
          }}
        >
          {slide.title}
        </h2>
        {slide.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image_url}
            alt={slide.title}
            style={{ maxWidth: "100%", marginBottom: 24, border: "var(--hair) solid var(--ink)" }}
          />
        ) : null}
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 18,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            flex: 1,
          }}
        >
          {slide.body}
        </div>
      </div>

      {/* Controls */}
      <div className="row-between" style={{ marginTop: 16, flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 6 }}>
          <Btn sm ghost onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> PREV
          </Btn>
          <Btn
            sm
            ghost
            onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
            disabled={idx >= slides.length - 1}
          >
            NEXT <Icon name="arrow" />
          </Btn>
        </div>
        <SlideDots count={slides.length} idx={idx} reached={reached} onPick={setIdx} />
        <div>
          {!done ? (
            <Btn onClick={complete} disabled={pending || !canComplete}>
              {pending ? "MARKING…" : canComplete ? "MARK COMPLETE" : "REACH LAST SLIDE"}{" "}
              <Icon name="check" />
            </Btn>
          ) : (
            <Chip>DONE</Chip>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideDots({
  count,
  idx,
  reached,
  onPick,
}: {
  count: number;
  idx: number;
  reached: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i === idx;
        const seen = i <= reached;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: 14,
              height: 14,
              border: "2px solid var(--ink)",
              background: active ? "var(--ink)" : seen ? "var(--ink)" : "var(--paper)",
              opacity: active ? 1 : seen ? 0.55 : 1,
              cursor: "pointer",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}
