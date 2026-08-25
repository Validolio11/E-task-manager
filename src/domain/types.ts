export const TASK_ICON_KEYS = ["search", "panels", "scan", "file", "code", "message", "sparkles", "list"] as const;
export type TaskIconKey = typeof TASK_ICON_KEYS[number];

export type Task = {
  id: string;
  title: string;
  project: string;
  plannedMinutes: number;
  icon: TaskIconKey;
  emoji?: string;
  status: "todo" | "completed";
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ActiveSession = {
  taskId: string;
  status: "running" | "paused";
  startedAt: number | null;
};

export type FocusEntry = {
  id: string;
  taskId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
};

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AppState = {
  version: 1;
  tasks: Task[];
  selectedTaskId: string | null;
  activeSession: ActiveSession | null;
  entries: FocusEntry[];
  aiMessages: AiMessage[];
};

export type TaskInput = Pick<Task, "title" | "project" | "plannedMinutes" | "icon" | "emoji">;
