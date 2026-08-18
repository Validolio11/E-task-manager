import { describe, expect, it } from "vitest";
import { experienceForHours, focusStage, FocusSession, sessionDuration, totalInside } from "./domain";

const session = (startedAt: string, endedAt: string | null, durationMs: number | null = null): FocusSession => ({
  id: "session-1",
  taskId: "task-1",
  startedAt,
  endedAt,
  durationMs,
  targetMinutes: 5,
  targetNotified: false,
});

describe("focus timer domain", () => {
  it("derives live elapsed time from timestamps", () => {
    const active = session("2026-08-18T12:00:00.000Z", null);
    expect(sessionDuration(active, Date.parse("2026-08-18T12:08:42.000Z"))).toBe(522_000);
  });

  it("keeps finalized duration stable", () => {
    const finished = session("2026-08-18T12:00:00.000Z", "2026-08-18T12:05:00.000Z", 299_500);
    expect(sessionDuration(finished, Date.parse("2027-01-01T00:00:00.000Z"))).toBe(299_500);
  });

  it("uses positive focus stages beyond the target", () => {
    expect(focusStage(0)).toBe("СТАРТ");
    expect(focusStage(5 * 60_000)).toBe("ФОКУС");
    expect(focusStage(15 * 60_000)).toBe("ПОТІК");
    expect(focusStage(30 * 60_000)).toBe("ГЛИБОКА РОБОТА");
    expect(focusStage(4 * 60 * 60_000)).toBe("ГЛИБОКА РОБОТА");
  });

  it("splits sessions correctly at analytics boundaries", () => {
    const crossingMidnight = session("2026-08-17T23:55:00.000Z", "2026-08-18T00:10:00.000Z", 900_000);
    const from = Date.parse("2026-08-18T00:00:00.000Z");
    const to = Date.parse("2026-08-19T00:00:00.000Z");
    expect(totalInside([crossingMidnight], from, to)).toBe(600_000);
  });
});

describe("experience levels", () => {
  it("respects level thresholds and progress", () => {
    expect(experienceForHours(0).level).toBe(1);
    expect(experienceForHours(10).level).toBe(2);
    expect(experienceForHours(482).level).toBe(7);
    expect(experienceForHours(500).level).toBe(8);
    expect(experienceForHours(10_000).level).toBe(15);
  });
});
