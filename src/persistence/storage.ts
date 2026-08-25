import { createInitialState, MAX_AI_MESSAGE_LENGTH, MAX_AI_MESSAGES, MAX_FOCUS_ENTRIES, MAX_TASKS } from "../domain/state";
import { TASK_ICON_KEYS, type ActiveSession, type AiMessage, type AppState, type FocusEntry, type Task } from "../domain/types";

const STORAGE_KEY = "etask.focus-dock.v1";
const RECOVERY_KEY = `${STORAGE_KEY}.recovery`;
const MAX_TITLE_LENGTH = 240;
const MAX_PROJECT_LENGTH = 160;

export type LoadStateResult = { state: AppState; warning: string | null };
export type SaveStateResult = { ok: true } | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseTask(value: unknown): Task | null {
  const task = record(value);
  if (!task
    || !nonEmptyText(task.id, 200)
    || !nonEmptyText(task.title, MAX_TITLE_LENGTH)
    || typeof task.project !== "string"
    || task.project.length > MAX_PROJECT_LENGTH
    || !Number.isInteger(task.plannedMinutes)
    || Number(task.plannedMinutes) < 1
    || Number(task.plannedMinutes) > 480
    || !TASK_ICON_KEYS.includes(task.icon as Task["icon"])
    || (task.emoji !== undefined && (typeof task.emoji !== "string" || task.emoji.trim().length === 0 || task.emoji.length > 24))
    || (task.status !== "todo" && task.status !== "completed")
    || !finiteNumber(task.order)) return null;

  const createdAt = validDate(task.createdAt) ? task.createdAt : new Date(0).toISOString();
  const updatedAt = validDate(task.updatedAt) ? task.updatedAt : createdAt;
  const completedAt = task.status === "completed" ? (validDate(task.completedAt) ? task.completedAt : updatedAt) : null;

  return {
    id: task.id,
    title: task.title.trim(),
    project: task.project.trim(),
    plannedMinutes: task.plannedMinutes as number,
    icon: task.icon as Task["icon"],
    ...(typeof task.emoji === "string" ? { emoji: task.emoji } : {}),
    status: task.status,
    order: task.order,
    createdAt,
    updatedAt,
    completedAt,
  };
}

function parseEntry(value: unknown, taskIds: Set<string>): FocusEntry | null {
  const entry = record(value);
  if (!entry
    || !nonEmptyText(entry.id, 200)
    || !nonEmptyText(entry.taskId, 200)
    || !taskIds.has(entry.taskId)
    || !finiteNumber(entry.startedAt)
    || !finiteNumber(entry.endedAt)
    || entry.startedAt < 0
    || entry.endedAt <= entry.startedAt) return null;
  return {
    id: entry.id,
    taskId: entry.taskId,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    durationMs: entry.endedAt - entry.startedAt,
  };
}

function parseMessage(value: unknown): AiMessage | null {
  const message = record(value);
  if (!message
    || !nonEmptyText(message.id, 200)
    || (message.role !== "user" && message.role !== "assistant")
    || typeof message.content !== "string"
    || message.content.length === 0
    || message.content.length > MAX_AI_MESSAGE_LENGTH
    || !validDate(message.createdAt)) return null;
  return { id: message.id, role: message.role, content: message.content, createdAt: message.createdAt };
}

function parseActiveSession(value: unknown, todoIds: Set<string>): ActiveSession | null {
  const session = record(value);
  if (!session || !nonEmptyText(session.taskId, 200) || !todoIds.has(session.taskId)) return null;
  if (session.status === "running" && finiteNumber(session.startedAt) && session.startedAt >= 0) {
    return { taskId: session.taskId, status: "running", startedAt: session.startedAt };
  }
  if (session.status === "paused" && session.startedAt === null) {
    return { taskId: session.taskId, status: "paused", startedAt: null };
  }
  return null;
}

function uniqueById<T extends { id: string }>(values: T[]) {
  const ids = new Set<string>();
  return values.filter((value) => {
    if (ids.has(value.id)) return false;
    ids.add(value.id);
    return true;
  });
}

export function recoverState(value: unknown): { state: AppState; recovered: boolean } {
  const parsed = record(value);
  if (!parsed) return { state: createInitialState(), recovered: true };

  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks = uniqueById(rawTasks.map(parseTask).filter((task): task is Task => task !== null)).slice(0, MAX_TASKS);
  const taskIds = new Set(tasks.map((task) => task.id));
  const todoIds = new Set(tasks.filter((task) => task.status === "todo").map((task) => task.id));

  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const entries = uniqueById(rawEntries.map((entry) => parseEntry(entry, taskIds)).filter((entry): entry is FocusEntry => entry !== null)).slice(-MAX_FOCUS_ENTRIES);
  const rawMessages = Array.isArray(parsed.aiMessages) ? parsed.aiMessages : [];
  const aiMessages = uniqueById(rawMessages.map(parseMessage).filter((message): message is AiMessage => message !== null)).slice(-MAX_AI_MESSAGES);

  const selectedTaskId = typeof parsed.selectedTaskId === "string" && todoIds.has(parsed.selectedTaskId)
    ? parsed.selectedTaskId
    : tasks.filter((task) => task.status === "todo").sort((a, b) => a.order - b.order)[0]?.id ?? null;
  const activeSession = parseActiveSession(parsed.activeSession, todoIds);

  const recovered = parsed.version !== 1
    || !Array.isArray(parsed.tasks) || JSON.stringify(tasks) !== JSON.stringify(rawTasks.slice(0, MAX_TASKS))
    || !Array.isArray(parsed.entries) || JSON.stringify(entries) !== JSON.stringify(rawEntries.slice(-MAX_FOCUS_ENTRIES))
    || !Array.isArray(parsed.aiMessages) || JSON.stringify(aiMessages) !== JSON.stringify(rawMessages.slice(-MAX_AI_MESSAGES))
    || parsed.selectedTaskId !== selectedTaskId
    || JSON.stringify(parsed.activeSession ?? null) !== JSON.stringify(activeSession);

  return { state: { version: 1, tasks, selectedTaskId, activeSession, entries, aiMessages }, recovered };
}

function preserveRecoveryCopy(raw: string) {
  try {
    localStorage.setItem(RECOVERY_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function loadStateResult(): LoadStateResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: createInitialState(), warning: null };
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      const backedUp = preserveRecoveryCopy(raw);
      return {
        state: createInitialState(),
        warning: backedUp
          ? "Дані були пошкоджені. Збережено резервну копію, застосунок відкрито з порожнім списком."
          : "Дані були пошкоджені й не вдалося створити резервну копію. Нові зміни можуть не зберегтися.",
      };
    }
    const result = recoverState(value);
    if (!result.recovered) return { state: result.state, warning: null };
    const backedUp = preserveRecoveryCopy(raw);
    return {
      state: result.state,
      warning: backedUp
        ? "Частину пошкоджених даних відновлено. Оригінал збережено як резервну копію."
        : "Частину даних відновлено, але резервну копію створити не вдалося.",
    };
  } catch {
    return { state: createInitialState(), warning: "Сховище недоступне. Зміни працюватимуть лише до закриття застосунку." };
  }
}

export function loadState(): AppState {
  return loadStateResult().state;
}

export function saveState(state: AppState): SaveStateResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, error: "Не вдалося зберегти зміни. Звільніть місце у сховищі та повторіть спробу." };
  }
}

export function clearState(): SaveStateResult {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не вдалося очистити локальні дані." };
  }
}

export { RECOVERY_KEY, STORAGE_KEY };
