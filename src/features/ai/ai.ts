import { invoke } from "@tauri-apps/api/core";
import { AiProvider, AppSnapshot, sessionDuration, startOfDay, startOfWeek, totalInside } from "../../domain";

export type { AiProvider } from "../../domain";
export type AiActionType = "create_project" | "create_task" | "update_task" | "complete_task";

export interface AiAction {
  type: AiActionType;
  title: string | null;
  taskId: string | null;
  projectId: string | null;
  projectTitle: string | null;
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

export function orderAiActionsForExecution<T extends Pick<AiAction, "type">>(actions: T[]) {
  return [...actions].sort((a, b) => Number(b.type === "create_project") - Number(a.type === "create_project"));
}

export function parseAiReply(raw: string): AiReply {
  const value = JSON.parse(raw) as Partial<AiReply>;
  if (typeof value.message !== "string" || !Array.isArray(value.actions)) {
    throw new Error("AI повернув відповідь у невідомому форматі.");
  }
  const actions = value.actions.filter((action) => {
    if (!action || typeof action !== "object") return false;
    const candidate = action as Partial<AiAction>;
    return Boolean(candidate.type && actionTypes.has(candidate.type));
  }).map((action): AiAction => {
    const candidate = action as Partial<AiAction>;
    return {
      type: candidate.type as AiActionType,
      title: typeof candidate.title === "string" ? candidate.title : null,
      taskId: typeof candidate.taskId === "string" ? candidate.taskId : null,
      projectId: typeof candidate.projectId === "string" ? candidate.projectId : null,
      projectTitle: typeof candidate.projectTitle === "string" ? candidate.projectTitle : null,
      description: typeof candidate.description === "string" ? candidate.description : null,
      skill: typeof candidate.skill === "string" ? candidate.skill : null,
      targetMinutes: typeof candidate.targetMinutes === "number" && Number.isFinite(candidate.targetMinutes) ? candidate.targetMinutes : null,
    };
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
  const sessions = data.settings.aiIncludeSessionHistory ? data.sessions.map((session) => ({
    taskId: session.taskId,
    startedAt: session.startedAt,
    durationMinutes: Math.round(sessionDuration(session, now) / 60_000),
  })) : [];
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
    "Для задачі без проєкту використовуй projectId: null і projectTitle: null. Для наявних сутностей використовуй точні ID з контексту.",
    "Якщо пропонуєш новий проєкт і задачі для нього в одній відповіді, у кожній такій задачі встанови projectId: null, а projectTitle — точну назву нового проєкту.",
    `Поточний час ISO: ${new Date(now).toISOString()}`,
    `Проєкти: ${JSON.stringify(projects)}`,
    `Задачі: ${JSON.stringify(tasks)}`,
    `Фокус-сесії: ${data.settings.aiIncludeSessionHistory ? JSON.stringify(sessions.slice(-200)) : "не передаються за вибором користувача"}`,
    `Підсумок: ${JSON.stringify(summary)}`,
    `Останній діалог: ${JSON.stringify(conversation)}`,
    `Запит користувача: ${question}`,
  ].join("\n\n");
}

export interface AiKeyStatus {
  openai: boolean;
  gemini: boolean;
}

const isDesktop = () => "__TAURI_INTERNALS__" in window;

export async function getAiKeyStatus(): Promise<AiKeyStatus> {
  if (!isDesktop()) return { openai: false, gemini: false };
  return invoke<AiKeyStatus>("ai_key_status");
}

export async function saveAiApiKey(provider: AiProvider, apiKey: string) {
  if (!isDesktop()) throw new Error("Захищене збереження ключів доступне у встановленому Windows-застосунку.");
  return invoke<void>("ai_save_api_key", { provider, apiKey });
}

export async function deleteAiApiKey(provider: AiProvider) {
  if (!isDesktop()) throw new Error("Захищене збереження ключів доступне у встановленому Windows-застосунку.");
  return invoke<void>("ai_delete_api_key", { provider });
}

export async function testAiConnection(provider: AiProvider, model: string) {
  if (!isDesktop()) throw new Error("Перевірка API доступна у встановленому Windows-застосунку.");
  return invoke<string>("ai_test_connection", { provider, model });
}

export async function cancelAiRequest(requestId: string) {
  if (!isDesktop()) return;
  return invoke<void>("ai_cancel_request", { requestId });
}

export async function askAi(provider: AiProvider, model: string, prompt: string, requestId: string) {
  if (!isDesktop()) {
    throw new Error("AI-чат доступний у встановленому Windows-застосунку.");
  }
  const raw = await invoke<string>("ai_request", {
    request: { requestId, provider, model, prompt },
  });
  return parseAiReply(raw);
}
