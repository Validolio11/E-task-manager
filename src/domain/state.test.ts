import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, MAX_AI_MESSAGES, MAX_FOCUS_ENTRIES, todayMs, trackedMs } from "./state";
import type { AppState, Task } from "./types";

function task(id: string, order: number, status: Task["status"] = "todo"): Task {
  const date = new Date(0).toISOString();
  return { id, title: id, project: "", plannedMinutes: 30, icon: "list", status, order, createdAt: date, updatedAt: date, completedAt: status === "completed" ? date : null };
}

function withTasks(...tasks: Task[]): AppState {
  return { ...createInitialState(), tasks, selectedTaskId: tasks.find((candidate) => candidate.status === "todo")?.id ?? null };
}

describe("focus state", () => {
  it("starts with real empty data instead of demo work", () => {
    expect(createInitialState()).toEqual({ version: 1, tasks: [], selectedTaskId: null, activeSession: null, entries: [], aiMessages: [] });
  });

  it("selects without starting a timer", () => {
    const initial = withTasks(task("first", 0), task("second", 1));
    const state = appReducer(initial, { type: "task/select", taskId: "second" });
    expect(state.selectedTaskId).toBe("second");
    expect(state.activeSession).toBeNull();
  });

  it("keeps only one active timer and finalizes the previous slice", () => {
    let state = appReducer(withTasks(task("first", 0), task("second", 1)), { type: "focus/start", taskId: "first", now: 1_000, entryId: "unused" });
    state = appReducer(state, { type: "focus/start", taskId: "second", now: 61_000, entryId: "entry-1" });
    expect(state.activeSession?.taskId).toBe("second");
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].durationMs).toBe(60_000);
  });

  it("ignores rapid duplicate start, pause, and complete actions", () => {
    const initial = withTasks(task("first", 0));
    const running = appReducer(initial, { type: "focus/start", taskId: "first", now: 1_000, entryId: "start" });
    expect(appReducer(running, { type: "focus/start", taskId: "first", now: 1_001, entryId: "duplicate" })).toBe(running);
    const paused = appReducer(running, { type: "focus/pause", now: 31_000, entryId: "entry" });
    expect(appReducer(paused, { type: "focus/pause", now: 31_001, entryId: "duplicate" })).toBe(paused);
    const completed = appReducer(paused, { type: "focus/complete", taskId: "first", now: 32_000, entryId: "complete" });
    expect(appReducer(completed, { type: "focus/complete", taskId: "first", now: 32_001, entryId: "duplicate" })).toBe(completed);
  });

  it("rejects focus actions for missing or completed tasks", () => {
    const initial = withTasks(task("done", 0, "completed"));
    expect(appReducer(initial, { type: "focus/start", taskId: "done", now: 1_000, entryId: "entry" })).toBe(initial);
    expect(appReducer(initial, { type: "focus/start", taskId: "missing", now: 1_000, entryId: "entry" })).toBe(initial);
  });

  it("rejects duplicate task IDs and invalid runtime inputs", () => {
    const initial = withTasks(task("first", 0));
    expect(appReducer(initial, { type: "task/create", task: task("first", 1) })).toBe(initial);
    expect(appReducer(initial, { type: "task/update", taskId: "first", input: { title: " ", project: "", plannedMinutes: 0, icon: "list" }, now: 1_000 })).toBe(initial);
    expect(appReducer(initial, { type: "ai/add", message: { id: "huge", role: "user", content: "x".repeat(20_001), createdAt: new Date(0).toISOString() } })).toBe(initial);
  });

  it("pauses without losing elapsed time and resumes explicitly", () => {
    let state = appReducer(withTasks(task("first", 0)), { type: "focus/start", taskId: "first", now: 1_000, entryId: "unused" });
    state = appReducer(state, { type: "focus/pause", now: 31_000, entryId: "entry-1" });
    expect(state.activeSession?.status).toBe("paused");
    expect(trackedMs(state, "first", 99_000)).toBe(30_000);
    state = appReducer(state, { type: "focus/start", taskId: "first", now: 100_000, entryId: "unused-2" });
    expect(trackedMs(state, "first", 110_000)).toBe(40_000);
  });

  it("completes the task and selects the next available one", () => {
    let state = appReducer(withTasks(task("first", 0), task("second", 1)), { type: "focus/start", taskId: "first", now: 1_000, entryId: "unused" });
    state = appReducer(state, { type: "focus/complete", taskId: "first", now: 61_000, entryId: "entry-1" });
    expect(state.tasks.find((candidate) => candidate.id === "first")?.status).toBe("completed");
    expect(state.activeSession).toBeNull();
    expect(state.selectedTaskId).toBe("second");
  });

  it("selects a task when it is reopened", () => {
    const state = appReducer(withTasks(task("first", 0), task("done", 1, "completed")), { type: "task/reopen", taskId: "done", now: 1_000 });
    expect(state.selectedTaskId).toBe("done");
    expect(state.tasks.find((candidate) => candidate.id === "done")?.status).toBe("todo");
  });

  it("counts only today's part of an entry crossing midnight", () => {
    const now = new Date(2026, 7, 25, 0, 10).getTime();
    const startedAt = new Date(2026, 7, 24, 23, 50).getTime();
    const state = withTasks(task("first", 0));
    state.entries = [{ id: "entry", taskId: "first", startedAt, endedAt: now, durationMs: 20 * 60_000 }];
    expect(todayMs(state, now)).toBe(10 * 60_000);
  });

  it("caps focus entries and AI history", () => {
    const entries = Array.from({ length: MAX_FOCUS_ENTRIES }, (_, index) => ({ id: `entry-${index}`, taskId: "first", startedAt: index * 2 + 1, endedAt: index * 2 + 2, durationMs: 1 }));
    let state: AppState = { ...withTasks(task("first", 0)), entries };
    state = appReducer(state, { type: "focus/start", taskId: "first", now: 30_000, entryId: "start" });
    state = appReducer(state, { type: "focus/pause", now: 31_000, entryId: "new-entry" });
    expect(state.entries).toHaveLength(MAX_FOCUS_ENTRIES);
    expect(state.entries.at(-1)?.id).toBe("new-entry");

    state = { ...state, aiMessages: Array.from({ length: MAX_AI_MESSAGES }, (_, index) => ({ id: `message-${index}`, role: "user" as const, content: "x", createdAt: new Date(index).toISOString() })) };
    state = appReducer(state, { type: "ai/add", message: { id: "new-message", role: "assistant", content: "ok", createdAt: new Date().toISOString() } });
    expect(state.aiMessages).toHaveLength(MAX_AI_MESSAGES);
    expect(state.aiMessages.at(-1)?.id).toBe("new-message");
  });
});
