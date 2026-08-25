import { TASK_ICON_KEYS, type ActiveSession, type AiMessage, type AppState, type FocusEntry, type Task, type TaskInput } from "./types";

export const MAX_FOCUS_ENTRIES = 10_000;
export const MAX_AI_MESSAGES = 200;
export const MAX_AI_MESSAGE_LENGTH = 20_000;
export const MAX_TASKS = 1_000;

export type AppAction =
  | { type: "task/select"; taskId: string }
  | { type: "task/create"; task: Task }
  | { type: "task/update"; taskId: string; input: TaskInput; now: number }
  | { type: "task/delete"; taskId: string }
  | { type: "focus/start"; taskId: string; now: number; entryId: string }
  | { type: "focus/pause"; now: number; entryId: string }
  | { type: "focus/complete"; taskId: string; now: number; entryId: string }
  | { type: "task/reopen"; taskId: string; now: number }
  | { type: "ai/add"; message: AppState["aiMessages"][number] }
  | { type: "state/replace"; state: AppState };

function validTimestamp(value: number) {
  return Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
}

function validTaskInput(input: TaskInput) {
  return typeof input.title === "string" && input.title.trim().length > 0 && input.title.length <= 240
    && typeof input.project === "string" && input.project.length <= 160
    && Number.isInteger(input.plannedMinutes) && input.plannedMinutes >= 1 && input.plannedMinutes <= 480
    && TASK_ICON_KEYS.includes(input.icon)
    && (input.emoji === undefined || (typeof input.emoji === "string" && input.emoji.trim().length > 0 && input.emoji.length <= 24));
}

function validTask(task: Task) {
  return typeof task.id === "string" && task.id.length > 0
    && validTaskInput(task)
    && (task.status === "todo" || task.status === "completed")
    && Number.isFinite(task.order)
    && Number.isFinite(Date.parse(task.createdAt))
    && Number.isFinite(Date.parse(task.updatedAt));
}

function validAiMessage(message: AiMessage) {
  return typeof message.id === "string" && message.id.length > 0
    && (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string" && message.content.length > 0 && message.content.length <= MAX_AI_MESSAGE_LENGTH
    && Number.isFinite(Date.parse(message.createdAt));
}

function entryFromSession(session: ActiveSession | null, now: number, entryId: string): FocusEntry | null {
  if (!session || session.status !== "running" || session.startedAt === null || !Number.isFinite(now) || now <= session.startedAt) return null;
  return { id: entryId, taskId: session.taskId, startedAt: session.startedAt, endedAt: now, durationMs: now - session.startedAt };
}

function appendEntry(entries: FocusEntry[], entry: FocusEntry | null) {
  if (!entry || entries.some((candidate) => candidate.id === entry.id)) return entries;
  return [...entries, entry].slice(-MAX_FOCUS_ENTRIES);
}

function nextTaskId(tasks: Task[], excludedId?: string) {
  return tasks.filter((task) => task.status === "todo" && task.id !== excludedId).sort((a, b) => a.order - b.order)[0]?.id ?? null;
}

function isTodoTask(state: AppState, taskId: string) {
  return state.tasks.some((task) => task.id === taskId && task.status === "todo");
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "task/select":
      return isTodoTask(state, action.taskId) && state.selectedTaskId !== action.taskId ? { ...state, selectedTaskId: action.taskId } : state;
    case "task/create":
      if (state.tasks.length >= MAX_TASKS || !validTask(action.task) || state.tasks.some((task) => task.id === action.task.id)) return state;
      return { ...state, tasks: [...state.tasks, action.task], selectedTaskId: action.task.id };
    case "task/update":
      if (!validTaskInput(action.input) || !validTimestamp(action.now) || !state.tasks.some((task) => task.id === action.taskId)) return state;
      return { ...state, tasks: state.tasks.map((task) => task.id === action.taskId ? { ...task, ...action.input, updatedAt: new Date(action.now).toISOString() } : task) };
    case "task/delete": {
      if (!state.tasks.some((task) => task.id === action.taskId)) return state;
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
      if (!isTodoTask(state, action.taskId) || !validTimestamp(action.now)) return state;
      if (state.activeSession?.taskId === action.taskId && state.activeSession.status === "running") return state;
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
      const task = state.tasks.find((candidate) => candidate.id === action.taskId);
      if (!task || task.status !== "todo" || !validTimestamp(action.now)) return state;
      const entry = state.activeSession?.taskId === action.taskId ? entryFromSession(state.activeSession, action.now, action.entryId) : null;
      const timestamp = new Date(action.now).toISOString();
      const tasks = state.tasks.map((candidate) => candidate.id === action.taskId ? { ...candidate, status: "completed" as const, completedAt: timestamp, updatedAt: timestamp } : candidate);
      return {
        ...state,
        tasks,
        entries: appendEntry(state.entries, entry),
        activeSession: state.activeSession?.taskId === action.taskId ? null : state.activeSession,
        selectedTaskId: state.selectedTaskId === action.taskId ? nextTaskId(tasks, action.taskId) : state.selectedTaskId,
      };
    }
    case "task/reopen": {
      const task = state.tasks.find((candidate) => candidate.id === action.taskId);
      if (!task || task.status !== "completed" || !validTimestamp(action.now)) return state;
      return {
        ...state,
        selectedTaskId: action.taskId,
        tasks: state.tasks.map((candidate) => candidate.id === action.taskId ? { ...candidate, status: "todo", completedAt: null, updatedAt: new Date(action.now).toISOString() } : candidate),
      };
    }
    case "ai/add":
      if (!validAiMessage(action.message) || state.aiMessages.some((message) => message.id === action.message.id)) return state;
      return { ...state, aiMessages: [...state.aiMessages, action.message].slice(-MAX_AI_MESSAGES) };
    case "state/replace":
      return action.state;
  }
}

export function createInitialState(): AppState {
  return {
    version: 1,
    tasks: [],
    selectedTaskId: null,
    activeSession: null,
    entries: [],
    aiMessages: [],
  };
}

export function trackedMs(state: AppState, taskId: string, now: number) {
  const finalized = state.entries.reduce((sum, entry) => entry.taskId === taskId && Number.isFinite(entry.durationMs) ? sum + Math.max(0, entry.durationMs) : sum, 0);
  const live = state.activeSession?.taskId === taskId && state.activeSession.status === "running" && state.activeSession.startedAt !== null ? Math.max(0, now - state.activeSession.startedAt) : 0;
  return finalized + live;
}

export function todayMs(state: AppState, now: number) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  const finalized = state.entries.reduce((sum, entry) => {
    const overlap = Math.max(0, Math.min(entry.endedAt, now) - Math.max(entry.startedAt, dayStart));
    return sum + overlap;
  }, 0);
  const live = state.activeSession?.status === "running" && state.activeSession.startedAt !== null ? Math.max(0, now - Math.max(dayStart, state.activeSession.startedAt)) : 0;
  return finalized + live;
}
