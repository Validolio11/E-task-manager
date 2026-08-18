import { describe, expect, it } from "vitest";
import { AppSnapshot, experienceForHours, focusStage, FocusSession, sanitizeSnapshot, sessionDuration, totalInside, trackedTimeByTask } from "./domain";

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

  it("aggregates all task totals in one pass", () => {
    const first = session("2026-08-18T12:00:00.000Z", "2026-08-18T12:05:00.000Z", 300_000);
    const second = { ...session("2026-08-18T13:00:00.000Z", "2026-08-18T13:10:00.000Z", 600_000), id: "session-2" };
    const other = { ...session("2026-08-18T14:00:00.000Z", "2026-08-18T14:02:00.000Z", 120_000), id: "session-3", taskId: "task-2" };
    const totals = trackedTimeByTask([first, second, other]);
    expect(totals.get("task-1")).toBe(900_000);
    expect(totals.get("task-2")).toBe(120_000);
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

const validBackup = (): AppSnapshot => ({
  schemaVersion: 1,
  projects: [{ id: "project-1", title: "Проєкт", description: "", skill: "Інше", status: "active", sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z" }],
  tasks: [{ id: "task-1", projectId: "project-1", title: "Задача", status: "todo", targetMinutes: 5, sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z", completedAt: null }],
  sessions: [],
  settings: { theme: "system", accent: "lime", compact: false, focusPresets: [5, 10], soundEnabled: true, aiProvider: "openai", openaiModel: "gpt-5-mini", geminiModel: "gemini-2.5-flash", aiIncludeSessionHistory: true, aiConsentAccepted: false },
});

describe("backup validation", () => {
  it("accepts a consistent snapshot", () => {
    expect(sanitizeSnapshot(validBackup()).tasks[0].title).toBe("Задача");
  });

  it("rejects orphan tasks before replacing local data", () => {
    const backup = validBackup();
    backup.tasks[0].projectId = "missing";
    expect(() => sanitizeSnapshot(backup)).toThrow(/пов’язаних даних/);
  });

  it("rejects multiple active sessions", () => {
    const backup = validBackup();
    backup.sessions = [session("2026-08-18T12:00:00.000Z", null), { ...session("2026-08-18T13:00:00.000Z", null), id: "session-2" }];
    expect(() => sanitizeSnapshot(backup)).toThrow(/кілька одночасно активних/);
  });

  it("normalizes unsafe settings and presets", () => {
    const backup = validBackup() as unknown as { settings: Record<string, unknown> } & Omit<AppSnapshot, "settings">;
    backup.settings = { theme: "unknown", accent: "lime", compact: false, focusPresets: [10, 10, -2, 500], soundEnabled: true };
    const result = sanitizeSnapshot(backup);
    expect(result.settings.theme).toBe("system");
    expect(result.settings.focusPresets).toEqual([10]);
    expect(result.settings.aiProvider).toBe("openai");
    expect(result.settings.openaiModel).toBe("gpt-5-mini");
    expect(result.settings.aiIncludeSessionHistory).toBe(true);
    expect(result.settings.aiConsentAccepted).toBe(false);
  });
});
