import type { ActiveSession, AppState, FocusEntry, Task, TaskInput } from "./types";

export type AppAction =
  | { type: "task/select"; taskId: string }
  | { type: "task/create"; task: Task }
  | { type: "task/update"; taskId: string; input: TaskInput; now: number }
  | { type: "task/delete"; taskId: string }
  | { type: "focus/start"; taskId: string; now: number; entryId: string }
  | { type: "focus/pause"; now: number; entryId: string }
  | { type: "focus/complete"; taskId: string; now: number; entryId: string }
  | { type: "task/reopen"; taskId: string; now: number }
  | { type: "ai/add"; message: AppState["aiMessages"][number] };

function entryFromSession(session: ActiveSession | null, now: number, entryId: string): FocusEntry | null {
  if (!session || session.status !== "running" || session.startedAt === null) return null;
  return { id: entryId, taskId: session.taskId, startedAt: session.startedAt, endedAt: now, durationMs: Math.max(0, now - session.startedAt) };
}

function appendEntry(entries: FocusEntry[], entry: FocusEntry | null) {
  return entry && entry.durationMs > 0 ? [...entries, entry] : entries;
}

function nextTaskId(tasks: Task[], excludedId?: string) {
  return tasks.filter((task) => task.status === "todo" && task.id !== excludedId).sort((a, b) => a.order - b.order)[0]?.id ?? null;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "task/select":
      return state.tasks.some((task) => task.id === action.taskId && task.status === "todo") ? { ...state, selectedTaskId: action.taskId } : state;
    case "task/create":
      return { ...state, tasks: [...state.tasks, action.task], selectedTaskId: action.task.id };
    case "task/update":
      return { ...state, tasks: state.tasks.map((task) => task.id === action.taskId ? { ...task, ...action.input, updatedAt: new Date(action.now).toISOString() } : task) };
    case "task/delete": {
      const tasks = state.tasks.filter((task) => task.id !== action.taskId);
      return {
        ...state,
        tasks,
        entries: state.entries.filter((entry) => entry.taskId !== action.taskId),
        activeSession: state.activeSession?.taskId === action.taskId ? null : state.activeSession,
        selectedTaskId: state.selectedTaskId === action.taskId ? nextTaskId(tasks) : state.selectedTaskId,
      };
    }
    case "focus/start": {
      const previous = entryFromSession(state.activeSession, action.now, action.entryId);
      return {
        ...state,
        selectedTaskId: action.taskId,
        activeSession: { taskId: action.taskId, status: "running", startedAt: action.now },
        entries: appendEntry(state.entries, previous),
      };
    }
    case "focus/pause": {
      if (!state.activeSession || state.activeSession.status !== "running") return state;
      const entry = entryFromSession(state.activeSession, action.now, action.entryId);
      return { ...state, entries: appendEntry(state.entries, entry), activeSession: { ...state.activeSession, status: "paused", startedAt: null } };
    }
    case "focus/complete": {
      const entry = state.activeSession?.taskId === action.taskId ? entryFromSession(state.activeSession, action.now, action.entryId) : null;
      const tasks = state.tasks.map((task) => task.id === action.taskId ? { ...task, status: "completed" as const, completedAt: new Date(action.now).toISOString(), updatedAt: new Date(action.now).toISOString() } : task);
      return {
        ...state,
        tasks,
        entries: appendEntry(state.entries, entry),
        activeSession: state.activeSession?.taskId === action.taskId ? null : state.activeSession,
        selectedTaskId: state.selectedTaskId === action.taskId ? nextTaskId(tasks, action.taskId) : state.selectedTaskId,
      };
    }
    case "task/reopen":
      return { ...state, tasks: state.tasks.map((task) => task.id === action.taskId ? { ...task, status: "todo", completedAt: null, updatedAt: new Date(action.now).toISOString() } : task) };
    case "ai/add":
      return { ...state, aiMessages: [...state.aiMessages, action.message] };
  }
}

export function createInitialState(now = Date.now()): AppState {
  const createdAt = new Date(now).toISOString();
  const tasks: Task[] = [
    { id: "presentation", title: "Презентація концепту", project: "Дизайн", plannedMinutes: 60, icon: "panels", emoji: "🎨", status: "todo", order: 0, createdAt, updatedAt: createdAt, completedAt: null },
    { id: "references", title: "Зібрати референси", project: "Дизайн", plannedMinutes: 30, icon: "search", emoji: "🔍", status: "todo", order: 1, createdAt, updatedAt: createdAt, completedAt: null },
    { id: "structure", title: "Оновити структуру", project: "E-task", plannedMinutes: 60, icon: "panels", emoji: "🛠️", status: "todo", order: 2, createdAt, updatedAt: createdAt, completedAt: null },
    { id: "responsive", title: "Адаптивність", project: "E-task", plannedMinutes: 45, icon: "scan", emoji: "📱", status: "todo", order: 3, createdAt, updatedAt: createdAt, completedAt: null }
  ];
  const pausedDuration = 38 * 60_000 + 24_000;
  return {
    version: 1,
    tasks,
    selectedTaskId: "references",
    activeSession: { taskId: "presentation", status: "paused", startedAt: null },
    entries: [{ id: "welcome-focus", taskId: "presentation", startedAt: now - pausedDuration, endedAt: now, durationMs: pausedDuration }],
    aiMessages: [],
  };
}

export function trackedMs(state: AppState, taskId: string, now: number) {
  const finalized = state.entries.reduce((sum, entry) => entry.taskId === taskId ? sum + entry.durationMs : sum, 0);
  const live = state.activeSession?.taskId === taskId && state.activeSession.status === "running" && state.activeSession.startedAt !== null ? Math.max(0, now - state.activeSession.startedAt) : 0;
  return finalized + live;
}

export function todayMs(state: AppState, now: number) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const finalized = state.entries.reduce((sum, entry) => entry.endedAt > start.getTime() ? sum + entry.durationMs : sum, 0);
  const live = state.activeSession?.status === "running" && state.activeSession.startedAt !== null ? Math.max(0, now - Math.max(start.getTime(), state.activeSession.startedAt)) : 0;
  return finalized + live;
}
