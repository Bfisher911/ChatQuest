import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { relativeTime } from "@/lib/utils/relative-time";

const FIXED_NOW = new Date("2026-05-02T12:00:00.000Z").getTime();

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns em-dash for null / undefined / invalid input", () => {
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime(undefined)).toBe("—");
    expect(relativeTime("not-a-date")).toBe("—");
  });

  test("under a minute reads as just now", () => {
    const ts = new Date(FIXED_NOW - 30_000).toISOString();
    expect(relativeTime(ts)).toBe("just now");
  });

  test("minutes / hours / days / months / years pluralize correctly", () => {
    const m5 = new Date(FIXED_NOW - 5 * 60_000).toISOString();
    expect(relativeTime(m5)).toBe("5m ago");
    const h3 = new Date(FIXED_NOW - 3 * 3600_000).toISOString();
    expect(relativeTime(h3)).toBe("3h ago");
    const d10 = new Date(FIXED_NOW - 10 * 86_400_000).toISOString();
    expect(relativeTime(d10)).toBe("10d ago");
    const mo2 = new Date(FIXED_NOW - 75 * 86_400_000).toISOString();
    expect(relativeTime(mo2)).toBe("2mo ago");
    const yr1 = new Date(FIXED_NOW - 400 * 86_400_000).toISOString();
    expect(relativeTime(yr1)).toBe("1y ago");
  });
});
