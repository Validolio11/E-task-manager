import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState, Task } from "../domain/types";
import { loadStateResult, RECOVERY_KEY, recoverState, saveState, STORAGE_KEY } from "./storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function task(id = "task", status: Task["status"] = "todo"): Task {
  const date = new Date(0).toISOString();
  return { id, title: "Задача", project: "Проєкт", plannedMinutes: 30, icon: "list", status, order: 0, createdAt: date, updatedAt: date, completedAt: status === "completed" ? date : null };
}

function state(): AppState {
  return { version: 1, tasks: [task()], selectedTaskId: "task", activeSession: null, entries: [], aiMessages: [] };
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("persistent state recovery", () => {
  it("opens clean installations without demo data", () => {
    expect(loadStateResult()).toEqual({ state: { version: 1, tasks: [], selectedTaskId: null, activeSession: null, entries: [], aiMessages: [] }, warning: null });
  });

  it("loads a complete valid state without a warning", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state()));
    expect(loadStateResult()).toEqual({ state: state(), warning: null });
  });

  it("salvages valid records, removes duplicates and orphan sessions", () => {
    const valid = task();
    const source = {
      version: 0,
      tasks: [valid, valid, { id: "broken" }],
      selectedTaskId: "missing",
      activeSession: { taskId: "missing", status: "running", startedAt: 10 },
      entries: [
        { id: "entry", taskId: "task", startedAt: 10, endedAt: 20, durationMs: 999 },
        { id: "entry", taskId: "task", startedAt: 10, endedAt: 20, durationMs: 10 },
        { id: "orphan", taskId: "missing", startedAt: 10, endedAt: 20, durationMs: 10 },
      ],
      aiMessages: [
        { id: "message", role: "user", content: "Привіт", createdAt: new Date(0).toISOString() },
        null,
      ],
    };
    const recovered = recoverState(source);
    expect(recovered.recovered).toBe(true);
    expect(recovered.state.tasks).toEqual([valid]);
    expect(recovered.state.entries).toEqual([{ id: "entry", taskId: "task", startedAt: 10, endedAt: 20, durationMs: 10 }]);
    expect(recovered.state.activeSession).toBeNull();
    expect(recovered.state.selectedTaskId).toBe("task");
    expect(recovered.state.aiMessages).toHaveLength(1);
  });

  it("preserves the original raw data before replacing malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not-json");
    const result = loadStateResult();
    expect(result.state.tasks).toEqual([]);
    expect(result.warning).toContain("резервну копію");
    expect(localStorage.getItem(RECOVERY_KEY)).toBe("{not-json");
  });

  it("preserves a recovery copy when only part of the state is invalid", () => {
    const raw = JSON.stringify({ ...state(), entries: [null] });
    localStorage.setItem(STORAGE_KEY, raw);
    const result = loadStateResult();
    expect(result.state.tasks).toHaveLength(1);
    expect(result.state.entries).toEqual([]);
    expect(localStorage.getItem(RECOVERY_KEY)).toBe(raw);
  });

  it("keeps a completed task with a missing completed date and repairs the date", () => {
    const completed = { ...task("done", "completed"), completedAt: null };
    const result = recoverState({ ...state(), tasks: [completed], selectedTaskId: null });
    expect(result.recovered).toBe(true);
    expect(result.state.tasks).toHaveLength(1);
    expect(result.state.tasks[0].completedAt).toBe(result.state.tasks[0].updatedAt);
  });

  it("reports storage quota failures without throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
    vi.stubGlobal("localStorage", storage);
    expect(saveState(state())).toEqual({ ok: false, error: expect.stringContaining("Не вдалося зберегти") });
  });
});
