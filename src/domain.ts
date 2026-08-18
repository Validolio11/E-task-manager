export type ViewKey = "home" | "projects" | "analytics" | "skills" | "settings";

export type ProjectStatus = "active" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "completed";
export type Theme = "light" | "dark" | "system";
export type Accent = "lime" | "yellow" | "blue" | "violet";

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

export function durationInside(session: FocusSession, from: number, to: number, now = Date.now()) {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : now;
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
  return {
    schemaVersion: 1,
    projects: input.projects as Project[],
    tasks: input.tasks as Task[],
    sessions: input.sessions as FocusSession[],
    settings: { ...defaultSettings, ...(input.settings ?? {}) },
  };
}
