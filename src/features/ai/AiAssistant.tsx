import { FormEvent, useMemo, useState } from "react";
import { Bot, Check, KeyRound, LoaderCircle, Plus, Send, ShieldCheck, Sparkles } from "lucide-react";
import { AppSnapshot, INBOX_PROJECT_ID, Project, Task } from "../../domain";
import { AiAction, AiChatMessage, AiProvider, askAi, buildAiPrompt, defaultModel } from "./ai";

type ProjectInput = Pick<Project, "title" | "description" | "skill">;
type TaskInput = Pick<Task, "title" | "projectId" | "targetMinutes">;

interface Props {
  data: AppSnapshot;
  now: number;
  createProject: (input: ProjectInput) => string;
  createTask: (input: TaskInput) => string;
  updateTask: (id: string, input: TaskInput) => void;
  completeTask: (id: string) => void;
}

const messageStorage = "etask.ai.messages";
const providerStorage = "etask.ai.provider";
const appliedStorage = "etask.ai.applied";
const keyStorage = (provider: AiProvider) => `etask.ai.session-key.${provider}`;

function loadMessages(): AiChatMessage[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(messageStorage) ?? "[]");
    return Array.isArray(value) ? value.slice(-30) : [];
  } catch {
    return [];
  }
}

function loadApplied() {
  try {
    const value = JSON.parse(sessionStorage.getItem(appliedStorage) ?? "[]");
    return new Set<string>(Array.isArray(value) ? value : []);
  } catch {
    return new Set<string>();
  }
}

function actionTitle(action: AiAction, data: AppSnapshot) {
  if (action.type === "create_project") return `Створити проєкт «${action.title ?? "Без назви"}»`;
  if (action.type === "create_task") return `Додати задачу «${action.title ?? "Без назви"}»`;
  const task = data.tasks.find((item) => item.id === action.taskId);
  if (action.type === "update_task") return `Оновити задачу «${task?.title ?? action.title ?? "Невідома"}»`;
  return `Завершити задачу «${task?.title ?? "Невідома"}»`;
}

export function AiAssistant({ data, now, createProject, createTask, updateTask, completeTask }: Props) {
  const initialProvider = sessionStorage.getItem(providerStorage) === "gemini" ? "gemini" : "openai";
  const [provider, setProvider] = useState<AiProvider>(initialProvider);
  const [model, setModel] = useState(() => sessionStorage.getItem(`etask.ai.model.${initialProvider}`) ?? defaultModel(initialProvider));
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(keyStorage(initialProvider)) ?? "");
  const [messages, setMessages] = useState<AiChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(loadApplied);
  const projectsById = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects]);

  const persistMessages = (next: AiChatMessage[]) => {
    const trimmed = next.slice(-30);
    setMessages(trimmed);
    sessionStorage.setItem(messageStorage, JSON.stringify(trimmed));
  };

  const changeProvider = (next: AiProvider) => {
    setProvider(next);
    sessionStorage.setItem(providerStorage, next);
    const nextModel = sessionStorage.getItem(`etask.ai.model.${next}`) ?? defaultModel(next);
    setModel(nextModel);
    setApiKey(sessionStorage.getItem(keyStorage(next)) ?? "");
  };

  const saveModel = (value: string) => {
    setModel(value);
    sessionStorage.setItem(`etask.ai.model.${provider}`, value);
  };

  const saveKey = (value: string) => {
    setApiKey(value);
    if (value) sessionStorage.setItem(keyStorage(provider), value);
    else sessionStorage.removeItem(keyStorage(provider));
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    if (!apiKey.trim()) {
      setError("Додай API-ключ ліворуч. Він зберігається лише до закриття E-task.");
      return;
    }
    const userMessage: AiChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const next = [...messages, userMessage];
    persistMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const reply = await askAi(provider, apiKey, model, buildAiPrompt(data, now, messages, question));
      persistMessages([...next, { id: crypto.randomUUID(), role: "assistant", content: reply.message, actions: reply.actions }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const applyAction = (messageId: string, index: number, action: AiAction) => {
    const key = `${messageId}:${index}`;
    if (applied.has(key)) return;
    if (action.type === "create_project" && action.title?.trim()) {
      createProject({ title: action.title, description: action.description ?? "", skill: action.skill ?? "Інше" });
    } else if (action.type === "create_project") {
      return setError("AI не вказав назву проєкту.");
    }
    if (action.type === "create_task" && action.title?.trim()) {
      const projectId = action.projectId && projectsById.has(action.projectId) ? action.projectId : "";
      createTask({ title: action.title, projectId, targetMinutes: Math.min(240, Math.max(1, action.targetMinutes ?? 15)) });
    } else if (action.type === "create_task") {
      return setError("AI не вказав назву задачі.");
    }
    if (action.type === "update_task" && action.taskId) {
      const task = data.tasks.find((item) => item.id === action.taskId);
      if (!task) return setError("Цю задачу вже не знайдено.");
      const requestedProject = action.projectId === null ? INBOX_PROJECT_ID : action.projectId;
      updateTask(task.id, {
        title: action.title?.trim() || task.title,
        projectId: requestedProject === INBOX_PROJECT_ID || (requestedProject && projectsById.has(requestedProject)) ? requestedProject : task.projectId,
        targetMinutes: Math.min(240, Math.max(1, action.targetMinutes ?? task.targetMinutes)),
      });
    }
    if (action.type === "complete_task" && action.taskId) {
      if (!data.tasks.some((task) => task.id === action.taskId)) return setError("Цю задачу вже не знайдено.");
      completeTask(action.taskId);
    }
    setApplied((current) => {
      const next = new Set(current).add(key);
      sessionStorage.setItem(appliedStorage, JSON.stringify([...next]));
      return next;
    });
  };

  return <section className="page ai-page page-enter">
    <div className="page-title"><div><span className="eyebrow-dark">ЛОКАЛЬНИЙ КОНТЕКСТ · КОНТРОЛЬ ДІЙ</span><h1>AI-помічник</h1><p>Аналізує проєкти й фокус, допомагає планувати та пропонує зміни лише з підтвердженням.</p></div></div>
    <div className="ai-layout">
      <aside className="card ai-settings">
        <div className="ai-settings-icon"><Bot size={23}/></div>
        <h2>Підключення</h2>
        <p>API-доступ оплачується окремо від підписки ChatGPT або Gemini.</p>
        <div className="ai-provider">
          <button className={provider === "openai" ? "active" : ""} onClick={() => changeProvider("openai")}>OpenAI</button>
          <button className={provider === "gemini" ? "active" : ""} onClick={() => changeProvider("gemini")}>Gemini</button>
        </div>
        <label>Модель<input value={model} onChange={(event) => saveModel(event.target.value)} spellCheck={false}/></label>
        <label>API-ключ<div className="ai-key-input"><KeyRound size={15}/><input type="password" value={apiKey} onChange={(event) => saveKey(event.target.value)} placeholder={provider === "openai" ? "sk-…" : "AIza…"}/></div></label>
        <div className="ai-privacy"><ShieldCheck size={17}/><span>Ключ не входить у SQLite чи backup. Він очищається після закриття застосунку.</span></div>
        <div className="ai-context-summary"><strong>AI побачить</strong><span>{data.projects.length} проєктів</span><span>{data.tasks.length} задач</span><span>{data.sessions.length} сесій</span></div>
      </aside>

      <section className="card ai-chat">
        <div className="ai-chat-head"><div><span className="ai-status"><i/> {provider === "openai" ? "OpenAI" : "Gemini"}</span><strong>Чат E-task</strong></div><button onClick={() => { persistMessages([]); setApplied(new Set()); sessionStorage.removeItem(appliedStorage); }} disabled={!messages.length}>Очистити чат</button></div>
        <div className="ai-messages">
          {!messages.length && <div className="ai-welcome"><span><Sparkles size={27}/></span><h2>Що розібрати?</h2><p>Запитай про навантаження, наступний крок або попроси підготувати задачі. Жодна зміна не застосовується автоматично.</p><div className="ai-suggestions">{["Проаналізуй мою продуктивність", "Що варто зробити наступним?", "Розбий активний проєкт на задачі"].map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div></div>}
          {messages.map((message) => <div className={`ai-message ${message.role}`} key={message.id}>
            <span>{message.role === "assistant" ? <Bot size={16}/> : "Ви"}</span>
            <div><p>{message.content}</p>{message.actions?.map((action, index) => {
              const key = `${message.id}:${index}`;
              const done = applied.has(key);
              return <article className="ai-action-card" key={key}><div><strong>{actionTitle(action, data)}</strong><small>{action.type.includes("task") && action.targetMinutes ? `Ціль: ${action.targetMinutes} хв` : "Перевір дію перед застосуванням"}</small></div><button disabled={done} onClick={() => applyAction(message.id, index, action)}>{done ? <><Check size={15}/> Застосовано</> : <><Plus size={15}/> Підтвердити</>}</button></article>;
            })}</div>
          </div>)}
          {busy && <div className="ai-message assistant"><span><Bot size={16}/></span><div className="ai-thinking"><LoaderCircle className="spin" size={17}/> Аналізую локальні дані…</div></div>}
        </div>
        {error && <div className="ai-error">{error}</div>}
        <form className="ai-composer" onSubmit={send}><textarea rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Наприклад: проаналізуй цей тиждень і запропонуй три наступні задачі…"/><button type="submit" disabled={busy || !input.trim()} aria-label="Надіслати"><Send size={18}/></button></form>
      </section>
    </div>
  </section>;
}
