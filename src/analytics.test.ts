import { describe, expect, it } from "vitest";
import { buildAnalyticsPeriod } from "./analytics";
import { FocusSession } from "./domain";

function session(start: Date, minutes: number): FocusSession {
  const endedAt = new Date(start.getTime() + minutes * 60_000);
  return { id: start.toISOString(), taskId: "task", startedAt: start.toISOString(), endedAt: endedAt.toISOString(), durationMs: minutes * 60_000, targetMinutes: 5, targetNotified: true };
}

describe("historical analytics periods", () => {
  it("builds a selected week and compares it with the previous week", () => {
    const now = new Date(2026, 7, 19, 12).getTime();
    const sessions = [session(new Date(2026, 7, 18, 10), 30), session(new Date(2026, 7, 11, 10), 15)];
    const result = buildAnalyticsPeriod(sessions, "week", now, now);
    expect(result.total).toBe(30 * 60_000);
    expect(result.previousTotal).toBe(15 * 60_000);
    expect(result.deltaLabel).toContain("+100%");
    expect(result.buckets).toHaveLength(7);
    expect(result.isCurrent).toBe(true);
  });

  it("uses calendar-safe month buckets including leap day", () => {
    const now = new Date(2024, 1, 29, 12).getTime();
    const result = buildAnalyticsPeriod([session(new Date(2024, 1, 29, 10), 20)], "month", now, now);
    expect(result.total).toBe(20 * 60_000);
    expect(result.buckets).toHaveLength(5);
    expect(result.buckets.at(-1)?.label).toBe("29–29");
    expect(result.deltaLabel).toBe("Перші дані для порівняння");
  });

  it("counts only the portion of a session inside the selected period", () => {
    const now = new Date(2026, 8, 1, 12).getTime();
    const crossing = session(new Date(2026, 7, 31, 23, 55), 15);
    const result = buildAnalyticsPeriod([crossing], "month", now, now);
    expect(result.total).toBe(10 * 60_000);
    expect(result.buckets[0].value).toBe(10 * 60_000);
  });

  it("creates twelve month buckets and moves across year boundaries", () => {
    const anchor = new Date(2025, 0, 2, 12).getTime();
    const result = buildAnalyticsPeriod([], "year", anchor, anchor);
    expect(result.buckets).toHaveLength(12);
    expect(new Date(result.previousAnchor).getFullYear()).toBe(2024);
    expect(new Date(result.nextAnchor).getFullYear()).toBe(2026);
    expect(result.deltaLabel).not.toContain("0%");
  });
});
