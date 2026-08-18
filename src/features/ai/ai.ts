import { invoke } from "@tauri-apps/api/core";
import { AppSnapshot, sessionDuration, startOfDay, startOfWeek, totalInside } from "../../domain";

export type AiProvider = "openai" | "gemini";
export type AiActionType = "create_project" | "create_task" | "update_task" | "complete_task";

export interface AiAction {
  type: AiActionType;
  title: string | null;
  taskId: string | null;
  projectId: string | null;
  description: string | null;
  skill: string | null;
  targetMinutes: number | null;
}

export interface AiReply {
  message: string;
  actions: AiAction[];
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AiAction[];
}

const actionTypes = new Set<AiActionType>(["create_project", "create_task", "update_task", "complete_task"]);

export function parseAiReply(raw: string): AiReply {
  const value = JSON.parse(raw) as Partial<AiReply>;
  if (typeof value.message !== "string" || !Array.isArray(value.actions)) {
    throw new Error("AI повернув відповідь у невідомому форматі.");
  }
  const actions = value.actions.filter((action): action is AiAction => {
    if (!action || typeof action !== "object") return false;
    const candidate = action as Partial<AiAction>;
    return Boolean(candidate.type && actionTypes.has(candidate.type));
  });
  return { message: value.message.trim() || "Готово.", actions };
}

export function buildAiPrompt(data: AppSnapshot, now: number, history: AiChatMessage[], question: string) {
  const projects = data.projects.map((project) => ({
    id: project.id,
    title: project.title,
    status: project.status,
    skill: project.skill,
  }));
  const tasks = data.tasks.map((task) => ({
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    targetMinutes: task.targetMinutes,
  }));
  const sessions = data.sessions.map((session) => ({
    taskId: session.taskId,
    startedAt: session.startedAt,
    durationMinutes: Math.round(sessionDuration(session, now) / 60_000),
  }));
  const today = startOfDay(new Date(now));
  const week = startOfWeek(new Date(now));
  const summary = {
    todayMinutes: Math.round(totalInside(data.sessions, today, today + 86_400_000, now) / 60_000),
    weekMinutes: Math.round(totalInside(data.sessions, week, week + 7 * 86_400_000, now) / 60_000),
    allTimeMinutes: Math.round(totalInside(data.sessions, 0, now + 1, now) / 60_000),
  };
  const conversation = history.slice(-8).map(({ role, content }) => ({ role, content }));

  return [
    "Ти — спокійний AI-помічник застосунку E-task. Відповідай українською, стисло й конкретно.",
    "Аналізуй лише надані локальні дані. Не вигадуй виконану роботу, дедлайни або статистику.",
    "Можеш запропонувати create_project, create_task, update_task або complete_task.",
    "Кожна дія лише пропозиція: застосунок окремо попросить підтвердження користувача.",
    "Не пропонуй видалення. Якщо користувач просить тільки аналіз або пораду, поверни actions: [].",
    "Для задачі без проєкту використовуй projectId: null. Для наявних сутностей використовуй точні ID з контексту.",
    `Поточний час ISO: ${new Date(now).toISOString()}`,
    `Проєкти: ${JSON.stringify(projects)}`,
    `Задачі: ${JSON.stringify(tasks)}`,
    `Фокус-сесії: ${JSON.stringify(sessions.slice(-200))}`,
    `Підсумок: ${JSON.stringify(summary)}`,
    `Останній діалог: ${JSON.stringify(conversation)}`,
    `Запит користувача: ${question}`,
  ].join("\n\n");
}

export async function askAi(provider: AiProvider, apiKey: string, model: string, prompt: string) {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("AI-чат доступний у встановленому Windows-застосунку.");
  }
  const raw = await invoke<string>("ai_request", {
    request: { provider, apiKey, model, prompt },
  });
  return parseAiReply(raw);
}

export function defaultModel(provider: AiProvider) {
  return provider === "openai" ? "gpt-5-mini" : "gemini-2.5-flash";
}
