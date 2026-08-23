import { describe, expect, it } from "vitest";
import { focusStageProgress } from "./focusPresentation";

describe("focus stage presentation", () => {
  it("fills each positive focus stage from elapsed timestamps", () => {
    expect(focusStageProgress(0)).toEqual([0, 0, 0, 0]);
    expect(focusStageProgress(5 * 60_000)).toEqual([100, 0, 0, 0]);
    expect(focusStageProgress(10 * 60_000)).toEqual([100, 50, 0, 0]);
    expect(focusStageProgress(15 * 60_000)).toEqual([100, 100, 0, 0]);
    expect(focusStageProgress(30 * 60_000)).toEqual([100, 100, 100, 0]);
    expect(focusStageProgress(4 * 60 * 60_000)).toEqual([100, 100, 100, 100]);
  });

  it("never produces negative or overflowing segment values", () => {
    for (const value of focusStageProgress(-5_000)) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of focusStageProgress(24 * 60 * 60_000)) expect(value).toBeLessThanOrEqual(100);
  });
});
