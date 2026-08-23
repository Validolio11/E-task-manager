import { useEffect, useMemo, useState } from "react";
import { FocusSession, sessionDuration } from "./domain";

export function useLiveNow(intervalMs: number | null) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (!intervalMs) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, intervalMs);
    const syncWhenVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [intervalMs]);

  return now;
}

export function useTrackedMsByTask(finalizedMsByTask: Map<string, number>, activeSession: FocusSession | null, now: number) {
  return useMemo(() => {
    if (!activeSession) return finalizedMsByTask;
    const totals = new Map(finalizedMsByTask);
    totals.set(activeSession.taskId, (totals.get(activeSession.taskId) ?? 0) + sessionDuration(activeSession, now));
    return totals;
  }, [activeSession, finalizedMsByTask, now]);
}
