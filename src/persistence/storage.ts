import { createInitialState } from "../domain/state";
import { TASK_ICON_KEYS, type AppState, type Task } from "../domain/types";

const STORAGE_KEY = "etask.focus-dock.v1";

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<Task>;
  return typeof task.id === "string"
    && typeof task.title === "string"
    && typeof task.project === "string"
    && Number.isInteger(task.plannedMinutes)
    && Number(task.plannedMinutes) > 0
    && TASK_ICON_KEYS.includes(task.icon as Task["icon"])
    && (task.emoji === undefined || (typeof task.emoji === "string" && task.emoji.trim().length > 0 && task.emoji.length <= 24))
    && (task.status === "todo" || task.status === "completed")
    && typeof task.order === "number";
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !parsed.tasks.every(isTask) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.aiMessages)) return createInitialState();
    const selectedTaskId = parsed.selectedTaskId && parsed.tasks.some((task) => task.id === parsed.selectedTaskId && task.status === "todo") ? parsed.selectedTaskId : parsed.tasks.find((task) => task.status === "todo")?.id ?? null;
    const activeSession = parsed.activeSession && parsed.tasks.some((task) => task.id === parsed.activeSession?.taskId && task.status === "todo") ? parsed.activeSession : null;
    return { version: 1, tasks: parsed.tasks, selectedTaskId, activeSession, entries: parsed.entries, aiMessages: parsed.aiMessages };
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY };
