import { describe, expect, it } from "vitest";
import { appReducer, createInitialState, trackedMs } from "./state";

describe("focus state", () => {
  it("selects without starting a timer", () => {
    const initial = createInitialState(0);
    const state = appReducer(initial, { type: "task/select", taskId: "structure" });
    expect(state.selectedTaskId).toBe("structure");
    expect(state.activeSession).toEqual(initial.activeSession);
  });

  it("keeps only one active timer and finalizes the previous slice", () => {
    let state = appReducer(createInitialState(0), { type: "focus/start", taskId: "references", now: 1000, entryId: "unused" });
    state = appReducer(state, { type: "focus/start", taskId: "structure", now: 61000, entryId: "entry-1" });
    expect(state.activeSession?.taskId).toBe("structure");
    expect(state.entries).toHaveLength(2);
    expect(state.entries.at(-1)?.durationMs).toBe(60000);
  });

  it("pauses without losing elapsed time and resumes explicitly", () => {
    let state = appReducer(createInitialState(0), { type: "focus/start", taskId: "references", now: 1000, entryId: "unused" });
    state = appReducer(state, { type: "focus/pause", now: 31000, entryId: "entry-1" });
    expect(state.activeSession?.status).toBe("paused");
    expect(trackedMs(state, "references", 99000)).toBe(30000);
    state = appReducer(state, { type: "focus/start", taskId: "references", now: 100000, entryId: "unused-2" });
    expect(state.activeSession?.status).toBe("running");
    expect(trackedMs(state, "references", 110000)).toBe(40000);
  });

  it("completes the task and selects the next available one", () => {
    let state = appReducer(createInitialState(0), { type: "focus/start", taskId: "references", now: 1000, entryId: "unused" });
    state = appReducer(state, { type: "focus/complete", taskId: "references", now: 61000, entryId: "entry-1" });
    expect(state.tasks.find((task) => task.id === "references")?.status).toBe("completed");
    expect(state.activeSession).toBeNull();
    expect(state.selectedTaskId).not.toBe("references");
  });
});
