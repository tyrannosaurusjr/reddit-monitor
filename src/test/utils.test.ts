import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime, getOptimalPostTime, getOptimalPostTimeFromAnalytics, cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for sub-minute times", () => {
    const date = new Date("2024-06-15T11:59:45Z");
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("returns minutes ago for times under an hour", () => {
    const date = new Date("2024-06-15T11:30:00Z");
    expect(formatRelativeTime(date)).toBe("30m ago");
  });

  it("returns hours ago for times under a day", () => {
    const date = new Date("2024-06-15T06:00:00Z");
    expect(formatRelativeTime(date)).toBe("6h ago");
  });

  it("returns days ago for times under a week", () => {
    const date = new Date("2024-06-12T12:00:00Z");
    expect(formatRelativeTime(date)).toBe("3d ago");
  });

  it("returns a locale date string for times over a week", () => {
    const date = new Date("2024-06-01T12:00:00Z");
    const result = formatRelativeTime(date);
    expect(result).not.toMatch(/ago$/);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getOptimalPostTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a future date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-12T10:00:00Z")); // Wednesday, before 15:00 UTC
    const result = getOptimalPostTime();
    expect(result.getTime()).toBeGreaterThan(Date.now());
  });

  it("skips to next day when past 15:00 UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-12T16:00:00Z")); // Wednesday, after 15:00 UTC
    const result = getOptimalPostTime();
    expect(result.getUTCHours()).toBe(15);
    expect(result.getUTCDate()).toBe(13); // Thursday
  });

  it("skips Sunday to Monday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-16T16:00:00Z")); // Sunday after cutoff
    const result = getOptimalPostTime();
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it("never schedules on a weekend", () => {
    // Test several past-cutoff scenarios and confirm no weekend results
    const saturdayTimes = [
      "2024-06-08T16:00:00Z",  // Saturday UTC
      "2024-06-09T16:00:00Z",  // Sunday UTC
    ];
    for (const t of saturdayTimes) {
      vi.setSystemTime(new Date(t));
      const result = getOptimalPostTime();
      const day = result.getUTCDay();
      expect(day, `expected weekday from ${t}, got UTC day ${day}`).not.toBe(0);
      expect(day, `expected weekday from ${t}, got UTC day ${day}`).not.toBe(6);
    }
  });
});

describe("getOptimalPostTimeFromAnalytics", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to default when no windows provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-12T10:00:00Z"));
    const fallback = getOptimalPostTime();
    const fromAnalytics = getOptimalPostTimeFromAnalytics([]);
    expect(fromAnalytics.getUTCHours()).toBe(fallback.getUTCHours());
  });

  it("uses the highest engagement window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-12T10:00:00Z")); // Wednesday
    const result = getOptimalPostTimeFromAnalytics([
      { dayOfWeek: 1, hourUtc: 14, engagementScore: 95 },
    ]);
    expect(result.getUTCHours()).toBe(14);
    expect(result.getUTCDay()).toBe(1); // Monday
  });
});
