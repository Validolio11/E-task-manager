import { invoke } from "@tauri-apps/api/core";
import type { AiMessage, Task } from "../../domain/types";
import type { AiSettings } from "./ai-settings";

type ApiMessage = { role: "system" | "user" | "assistant"; content: string };

export function completionUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

function buildMessages(messages: AiMessage[], tasks: Task[], selectedTaskId: string | null): ApiMessage[] {
  const openTasks = tasks.filter((task) => task.status === "todo").sort((a, b) => a.order - b.order);
  const selected = openTasks.find((task) => task.id === selectedTaskId);
  const taskContext = openTasks.length
    ? openTasks.map((task) => `- ${task.title} (${task.project || "без проєкту"}, ${task.plannedMinutes} хв)${task.id === selectedTaskId ? " — вибрана" : ""}`).join("\n")
    : "Активних задач немає.";
  return [
    {
      role: "system",
      content: `Ти лаконічний AI-помічник у застосунку E-task. Відповідай українською, допомагай визначити конкретний наступний крок і не стверджуй, що сам змінив задачі. Поточний вибір: ${selected?.title ?? "немає"}.\nАктивні задачі:\n${taskContext}`,
    },
    ...messages.slice(-16).map(({ role, content }) => ({ role, content })),
  ];
}

function apiError(status: number, payload: unknown) {
  if (status === 401 || status === 403) return new Error("API відхилив ключ. Перевірте ключ і доступ до моделі.");
  if (status === 429) return new Error("Ліміт API вичерпано або забагато запитів. Спробуйте пізніше.");
  const message = payload && typeof payload === "object" && "error" in payload
    ? (payload as { error?: { message?: unknown } }).error?.message
    : undefined;
  return new Error(typeof message === "string" && message.length < 240 ? message : `API повернув помилку ${status}.`);
}

export async function requestAiReply(settings: AiSettings, messages: AiMessage[], tasks: Task[], selectedTaskId: string | null, signal?: AbortSignal) {
  const request = {
    endpoint: completionUrl(settings.baseUrl),
    model: settings.model,
    apiKey: settings.apiKey,
    messages: buildMessages(messages, tasks, selectedTaskId),
  };
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      return await invoke<string>("ai_chat", { request });
    } catch (error) {
      throw new Error(typeof error === "string" ? error : "Не вдалося отримати відповідь AI.");
    }
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = globalThis.setTimeout(abort, 45_000);
  try {
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: request.model, messages: request.messages }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    if (!response.ok) throw apiError(response.status, payload);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("API не повернув текстову відповідь.");
    return content.trim();
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Запит до AI перервано або перевищив 45 секунд.");
    throw error instanceof Error ? error : new Error("Не вдалося отримати відповідь AI.");
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
