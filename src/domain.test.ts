import { describe, expect, it } from "vitest";
import { addCalendarDays, AppSnapshot, DEFAULT_TASK_ICON_KEY, experienceForHours, focusStage, FocusSession, isTaskTargetMinutes, normalizeTaskIconKey, removeTaskWithSessions, sanitizeSnapshot, sessionDuration, setTaskTargetMinutes, TASK_ICON_KEYS, totalInside, trackedTimeByTask } from "./domain";

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

  it("uses the finalized duration consistently in analytics", () => {
    const finished = session("2026-08-18T12:00:00.000Z", "2026-08-18T12:05:00.000Z", 299_500);
    const from = Date.parse("2026-08-18T12:00:00.000Z");
    const to = Date.parse("2026-08-18T13:00:00.000Z");
    expect(totalInside([finished], from, to)).toBe(299_500);
    expect(totalInside([finished], from + 120_000, to)).toBe(179_500);
  });

  it("moves between local calendar days without assuming a fixed day length", () => {
    const start = new Date(2026, 0, 31).getTime();
    const next = new Date(addCalendarDays(start, 1));
    expect(next.getDate()).toBe(1);
    expect(next.getMonth()).toBe(1);
    expect(new Date(addCalendarDays(start, -31)).getFullYear()).toBe(2025);
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
  tasks: [{ id: "task-1", projectId: "project-1", title: "Задача", status: "todo", targetMinutes: 5, iconKey: "list-todo", sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z", completedAt: null }],
  sessions: [],
  settings: { theme: "system", accent: "lime", compact: false, focusPresets: [5, 10], soundEnabled: true, aiProvider: "openai", openaiModel: "gpt-5-mini", geminiModel: "gemini-2.5-flash", aiIncludeSessionHistory: true, aiConsentAccepted: false, aiConsentVersion: 0 },
});

describe("task icon catalog", () => {
  it("keeps every supported key and falls back for untrusted values", () => {
    expect(TASK_ICON_KEYS.map(normalizeTaskIconKey)).toEqual(TASK_ICON_KEYS);
    expect(normalizeTaskIconKey("arbitrary-svg")).toBe(DEFAULT_TASK_ICON_KEY);
    expect(normalizeTaskIconKey(null)).toBe(DEFAULT_TASK_ICON_KEY);
  });
});

describe("task focus target", () => {
  it("accepts only whole minutes within the supported range", () => {
    expect([1, 5, 60, 240].every(isTaskTargetMinutes)).toBe(true);
    expect([0, -1, 1.5, 241, Number.NaN, Number.POSITIVE_INFINITY].some(isTaskTargetMinutes)).toBe(false);
  });

  it("updates the task target without changing tracked or active sessions", () => {
    const backup = validBackup();
    backup.sessions = [session("2026-08-18T12:00:00.000Z", null)];
    const next = setTaskTargetMinutes(backup, "task-1", 60, "2026-08-18T12:03:00.000Z");
    expect(next.tasks[0].targetMinutes).toBe(60);
    expect(next.tasks[0].updatedAt).toBe("2026-08-18T12:03:00.000Z");
    expect(next.sessions).toBe(backup.sessions);
    expect(next.sessions[0]).toEqual(backup.sessions[0]);
  });

  it("rejects an invalid target or missing task", () => {
    expect(() => setTaskTargetMinutes(validBackup(), "task-1", 0, new Date().toISOString())).toThrow(/від 1 до 240/);
    expect(() => setTaskTargetMinutes(validBackup(), "missing", 15, new Date().toISOString())).toThrow(/не знайдено/);
  });
});

describe("task deletion", () => {
  it("removes the task and all its sessions without touching unrelated data", () => {
    const backup = validBackup();
    backup.tasks.push({ ...backup.tasks[0], id: "task-2", title: "Інша задача" });
    backup.sessions = [
      session("2026-08-18T12:00:00.000Z", null),
      { ...session("2026-08-18T13:00:00.000Z", "2026-08-18T13:05:00.000Z", 300_000), id: "session-2" },
      { ...session("2026-08-18T14:00:00.000Z", "2026-08-18T14:02:00.000Z", 120_000), id: "session-3", taskId: "task-2" },
    ];
    const next = removeTaskWithSessions(backup, "task-1");
    expect(next.tasks.map((task) => task.id)).toEqual(["task-2"]);
    expect(next.sessions.map((item) => item.id)).toEqual(["session-3"]);
    expect(next.projects).toBe(backup.projects);
  });
});

describe("backup validation", () => {
  it("accepts a consistent snapshot", () => {
    expect(sanitizeSnapshot(validBackup()).tasks[0].title).toBe("Задача");
  });

  it("adds a safe icon to legacy tasks and replaces unknown icon keys", () => {
    const legacy = validBackup() as unknown as { tasks: Array<Record<string, unknown>> };
    delete legacy.tasks[0].iconKey;
    expect(sanitizeSnapshot(legacy).tasks[0].iconKey).toBe(DEFAULT_TASK_ICON_KEY);

    const unsafe = validBackup() as unknown as { tasks: Array<Record<string, unknown>> };
    unsafe.tasks[0].iconKey = "<svg onload=alert(1)>";
    expect(sanitizeSnapshot(unsafe).tasks[0].iconKey).toBe(DEFAULT_TASK_ICON_KEY);
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
    expect(result.settings.aiConsentVersion).toBe(0);
  });
});
