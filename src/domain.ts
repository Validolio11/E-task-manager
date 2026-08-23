export type ViewKey = "home" | "projects" | "analytics" | "skills" | "ai" | "settings";

export type ProjectStatus = "active" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "completed";
export type Theme = "light" | "dark" | "system";
export type Accent = "lime" | "yellow" | "blue" | "violet";
export type AiProvider = "openai" | "gemini";
export const INBOX_PROJECT_ID = "system-inbox";
export const AI_CONTEXT_CONSENT_VERSION = 2;

export const TASK_ICON_KEYS = [
  "list-todo",
  "code",
  "design",
  "writing",
  "research",
  "learning",
  "communication",
  "planning",
  "document",
  "analysis",
  "marketing",
  "build",
  "health",
  "fitness",
  "creative",
  "video",
] as const;

export type TaskIconKey = typeof TASK_ICON_KEYS[number];
export const DEFAULT_TASK_ICON_KEY: TaskIconKey = "list-todo";
const taskIconKeySet = new Set<string>(TASK_ICON_KEYS);

export function isTaskIconKey(value: unknown): value is TaskIconKey {
  return typeof value === "string" && taskIconKeySet.has(value);
}

export function normalizeTaskIconKey(value: unknown): TaskIconKey {
  return isTaskIconKey(value) ? value : DEFAULT_TASK_ICON_KEY;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  skill: string;
  status: ProjectStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  targetMinutes: number;
  iconKey: TaskIconKey;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface FocusSession {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  targetMinutes: number;
  targetNotified: boolean;
}

export interface AppSettings {
  theme: Theme;
  accent: Accent;
  compact: boolean;
  focusPresets: number[];
  soundEnabled: boolean;
  aiProvider: AiProvider;
  openaiModel: string;
  geminiModel: string;
  aiIncludeSessionHistory: boolean;
  aiConsentAccepted: boolean;
  aiConsentVersion: number;
}

export interface AppSnapshot {
  schemaVersion: 1;
  projects: Project[];
  tasks: Task[];
  sessions: FocusSession[];
  settings: AppSettings;
}

export const defaultSettings: AppSettings = {
  theme: "system",
  accent: "lime",
  compact: false,
  focusPresets: [5, 10, 15],
  soundEnabled: true,
  aiProvider: "openai",
  openaiModel: "gpt-5-mini",
  geminiModel: "gemini-2.5-flash",
  aiIncludeSessionHistory: true,
  aiConsentAccepted: false,
  aiConsentVersion: 0,
};

export const emptySnapshot = (): AppSnapshot => ({
  schemaVersion: 1,
  projects: [],
  tasks: [],
  sessions: [],
  settings: { ...defaultSettings },
});

export const skillLevels = [
  ["Перші кроки", 0],
  ["Дослідник", 10],
  ["Початківець", 25],
  ["Учень", 50],
  ["Творець", 100],
  ["Практик", 200],
  ["Регулярна практика", 350],
  ["Умілий", 500],
  ["Досвідчений", 750],
  ["Просунутий", 1000],
  ["Загартований", 1500],
  ["Глибока практика", 2500],
  ["Ветеран", 4000],
  ["Шлях майстерності", 6500],
  ["Майстер справи", 10000],
] as const;

export function sessionDuration(session: FocusSession, now = Date.now()) {
  if (session.endedAt) return Math.max(0, session.durationMs ?? Date.parse(session.endedAt) - Date.parse(session.startedAt));
  return Math.max(0, now - Date.parse(session.startedAt));
}

export function taskTrackedMs(taskId: string, sessions: FocusSession[], now = Date.now()) {
  return sessions.filter((session) => session.taskId === taskId).reduce((sum, session) => sum + sessionDuration(session, now), 0);
}

export function trackedTimeByTask(sessions: FocusSession[], now = Date.now()) {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.taskId, (totals.get(session.taskId) ?? 0) + sessionDuration(session, now));
  }
  return totals;
}

export function formatDuration(ms: number, compact = false) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return compact ? `${minutes}хв` : `${minutes} хв`;
  if (!minutes) return compact ? `${hours}год` : `${hours} год`;
  return compact ? `${hours}год ${minutes}хв` : `${hours} год ${minutes} хв`;
}

export function formatTimer(ms: number) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${String(hours).padStart(2, "0")}:${base}` : base;
}

export function isTaskTargetMinutes(value: number): value is number {
  return Number.isInteger(value) && value >= 1 && value <= 240;
}

export function setTaskTargetMinutes(snapshot: AppSnapshot, taskId: string, targetMinutes: number, updatedAt: string): AppSnapshot {
  if (!isTaskTargetMinutes(targetMinutes)) throw new Error("Ціль фокусу має бути цілим числом від 1 до 240 хвилин.");
  if (!snapshot.tasks.some((task) => task.id === taskId)) throw new Error("Задачу не знайдено.");
  return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => task.id === taskId ? { ...task, targetMinutes, updatedAt } : task),
  };
}

export function removeTaskWithSessions(snapshot: AppSnapshot, taskId: string): AppSnapshot {
  return {
    ...snapshot,
    tasks: snapshot.tasks.filter((task) => task.id !== taskId),
    sessions: snapshot.sessions.filter((session) => session.taskId !== taskId),
  };
}

export function focusStage(ms: number) {
  const minutes = ms / 60_000;
  if (minutes < 5) return "СТАРТ";
  if (minutes < 15) return "ФОКУС";
  if (minutes < 30) return "ПОТІК";
  return "ГЛИБОКА РОБОТА";
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function startOfWeek(date = new Date()) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result.getTime();
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

export function addCalendarDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function durationInside(session: FocusSession, from: number, to: number, now = Date.now()) {
  const start = Date.parse(session.startedAt);
  // A finalized duration is the canonical value. Deriving the end solely from
  // wall-clock timestamps can make analytics disagree with task totals after a
  // system clock correction or a restored backup.
  const end = session.endedAt && session.durationMs !== null
    ? start + Math.max(0, session.durationMs)
    : session.endedAt ? Date.parse(session.endedAt) : now;
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

export function totalInside(sessions: FocusSession[], from: number, to: number, now = Date.now()) {
  return sessions.reduce((total, session) => total + durationInside(session, from, to, now), 0);
}

export function experienceForHours(hours: number) {
  let index = 0;
  for (let i = 0; i < skillLevels.length; i += 1) {
    if (hours >= skillLevels[i][1]) index = i;
  }
  const current = skillLevels[index];
  const next = skillLevels[index + 1];
  const progress = next ? Math.min(100, ((hours - current[1]) / (next[1] - current[1])) * 100) : 100;
  return { level: index + 1, name: current[0], progress, nextHours: next?.[1] ?? current[1] };
}

export function sanitizeSnapshot(value: unknown): AppSnapshot {
  if (!value || typeof value !== "object") throw new Error("Файл резервної копії пошкоджений.");
  const input = value as Partial<AppSnapshot>;
  if (!Array.isArray(input.projects) || !Array.isArray(input.tasks) || !Array.isArray(input.sessions)) {
    throw new Error("У резервній копії немає потрібних даних.");
  }
  const isDate = (date: unknown) => typeof date === "string" && Number.isFinite(Date.parse(date));
  const isText = (text: unknown) => typeof text === "string";
  const positiveMinutes = (minutes: unknown): minutes is number => typeof minutes === "number" && isTaskTargetMinutes(minutes);
  const normalizedTasks = (input.tasks as unknown[]).map((task) => task && typeof task === "object"
    ? { ...task, iconKey: normalizeTaskIconKey((task as Partial<Task>).iconKey) }
    : task);
  const validProject = (project: unknown): project is Project => {
    if (!project || typeof project !== "object") return false;
    const item = project as Partial<Project>;
    return isText(item.id) && Boolean(item.id) && isText(item.title) && Boolean(item.title.trim())
      && isText(item.description) && isText(item.skill) && ["active", "completed", "archived"].includes(item.status ?? "")
      && Number.isFinite(item.sortOrder) && isDate(item.createdAt) && isDate(item.updatedAt);
  };
  const validTask = (task: unknown): task is Task => {
    if (!task || typeof task !== "object") return false;
    const item = task as Partial<Task>;
    return isText(item.id) && Boolean(item.id) && isText(item.projectId) && isText(item.title) && Boolean(item.title.trim())
      && ["todo", "in_progress", "completed"].includes(item.status ?? "") && positiveMinutes(item.targetMinutes)
      && isTaskIconKey(item.iconKey)
      && Number.isFinite(item.sortOrder) && isDate(item.createdAt) && isDate(item.updatedAt)
      && (item.completedAt === null || isDate(item.completedAt));
  };
  const validSession = (session: unknown): session is FocusSession => {
    if (!session || typeof session !== "object") return false;
    const item = session as Partial<FocusSession>;
    return isText(item.id) && Boolean(item.id) && isText(item.taskId) && isDate(item.startedAt)
      && (item.endedAt === null || isDate(item.endedAt))
      && (item.durationMs === null || (typeof item.durationMs === "number" && Number.isFinite(item.durationMs) && item.durationMs >= 0))
      && positiveMinutes(item.targetMinutes) && typeof item.targetNotified === "boolean";
  };
  if (!input.projects.every(validProject) || !normalizedTasks.every(validTask) || !input.sessions.every(validSession)) {
    throw new Error("Резервна копія містить некоректні проєкти, задачі або сесії.");
  }
  const projectIds = new Set(input.projects.map((project) => project.id));
  const tasks = normalizedTasks as Task[];
  const taskIds = new Set(tasks.map((task) => task.id));
  if (projectIds.size !== input.projects.length || taskIds.size !== tasks.length || new Set(input.sessions.map((session) => session.id)).size !== input.sessions.length) {
    throw new Error("Резервна копія містить дублікати записів.");
  }
  if (tasks.some((task) => !projectIds.has(task.projectId)) || input.sessions.some((session) => !taskIds.has(session.taskId))) {
    throw new Error("Резервна копія містить задачі або сесії без пов’язаних даних.");
  }
  if (input.sessions.filter((session) => !session.endedAt).length > 1) {
    throw new Error("Резервна копія містить кілька одночасно активних сесій.");
  }
  const sourceSettings: Record<string, unknown> = input.settings && typeof input.settings === "object" ? input.settings as unknown as Record<string, unknown> : {};
  const theme: Theme = ["system", "light", "dark"].includes(String(sourceSettings.theme ?? "")) ? sourceSettings.theme as Theme : defaultSettings.theme;
  const accent: Accent = ["lime", "yellow", "blue", "violet"].includes(String(sourceSettings.accent ?? "")) ? sourceSettings.accent as Accent : defaultSettings.accent;
  const aiProvider: AiProvider = ["openai", "gemini"].includes(String(sourceSettings.aiProvider ?? "")) ? sourceSettings.aiProvider as AiProvider : defaultSettings.aiProvider;
  const safeModel = (value: unknown, fallback: string) => typeof value === "string" && value.trim() && value.length <= 100 ? value.trim() : fallback;
  const focusPresets = Array.isArray(sourceSettings.focusPresets)
    ? [...new Set(sourceSettings.focusPresets.filter(positiveMinutes))].sort((a, b) => a - b)
    : defaultSettings.focusPresets;
  return {
    schemaVersion: 1,
    projects: input.projects,
    tasks,
    sessions: input.sessions,
    settings: {
      theme,
      accent,
      compact: typeof sourceSettings.compact === "boolean" ? sourceSettings.compact : defaultSettings.compact,
      focusPresets: focusPresets.length ? focusPresets : defaultSettings.focusPresets,
      soundEnabled: typeof sourceSettings.soundEnabled === "boolean" ? sourceSettings.soundEnabled : defaultSettings.soundEnabled,
      aiProvider,
      openaiModel: safeModel(sourceSettings.openaiModel, defaultSettings.openaiModel),
      geminiModel: safeModel(sourceSettings.geminiModel, defaultSettings.geminiModel),
      aiIncludeSessionHistory: typeof sourceSettings.aiIncludeSessionHistory === "boolean" ? sourceSettings.aiIncludeSessionHistory : defaultSettings.aiIncludeSessionHistory,
      aiConsentAccepted: typeof sourceSettings.aiConsentAccepted === "boolean" ? sourceSettings.aiConsentAccepted : defaultSettings.aiConsentAccepted,
      aiConsentVersion: typeof sourceSettings.aiConsentVersion === "number" && Number.isInteger(sourceSettings.aiConsentVersion)
        ? sourceSettings.aiConsentVersion
        : defaultSettings.aiConsentVersion,
    },
  };
}
