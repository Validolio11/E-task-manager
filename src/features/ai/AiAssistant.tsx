import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Edit3, KeyRound, LoaderCircle, Plus, RefreshCw, Send, Settings as SettingsIcon, Sparkles, Square, WandSparkles, X } from "lucide-react";
import { AppSettings, AppSnapshot, INBOX_PROJECT_ID, Project, Task } from "../../domain";
import { RequestConfirmation } from "../../components/ConfirmDialog";
import { AiAction, AiChatMessage, AiKeyStatus, askAi, buildAiPrompt, cancelAiRequest, getAiKeyStatus, orderAiActionsForExecution } from "./ai";

type ProjectInput = Pick<Project, "title" | "description" | "skill">;
type TaskInput = Pick<Task, "title" | "projectId" | "targetMinutes">;

interface Props {
  data: AppSnapshot;
  createProject: (input: ProjectInput) => string;
  createTask: (input: TaskInput) => string;
  updateTask: (id: string, input: TaskInput) => void;
  completeTask: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  requestConfirmation: RequestConfirmation;
}

const messageStorage = "etask.ai.messages";
const appliedStorage = "etask.ai.applied";
const normalizeTitle = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("uk-UA") ?? "";

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

function actionSummary(actions: AiAction[]) {
  const groups: [number, string][] = [
    [actions.filter((action) => action.type === "create_project").length, "проєктів"],
    [actions.filter((action) => action.type === "create_task").length, "задач"],
    [actions.filter((action) => action.type === "update_task").length, "оновлень"],
    [actions.filter((action) => action.type === "complete_task").length, "завершень"],
  ];
  return groups.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join(" · ");
}

export function AiAssistant({ data, createProject, createTask, updateTask, completeTask, updateSettings, onOpenSettings, requestConfirmation }: Props) {
  const provider = data.settings.aiProvider;
  const model = provider === "openai" ? data.settings.openaiModel : data.settings.geminiModel;
  const [keyStatus, setKeyStatus] = useState<AiKeyStatus | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(loadApplied);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [retryContext, setRetryContext] = useState<{ question: string; history: AiChatMessage[] } | null>(null);
  const projectsById = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects]);
  const activeRequestId = useRef<string | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const createdProjectIds = useRef(new Map<string, string>());
  const hasKey = keyStatus?.[provider] ?? false;

  useEffect(() => {
    let active = true;
    getAiKeyStatus().then((status) => active && setKeyStatus(status)).catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, [provider]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, error]);

  const persistMessages = (next: AiChatMessage[]) => {
    const trimmed = next.slice(-30);
    setMessages(trimmed);
    sessionStorage.setItem(messageStorage, JSON.stringify(trimmed));
  };

  const markApplied = (keys: string[]) => {
    setApplied((current) => {
      const next = new Set(current);
      keys.forEach((key) => next.add(key));
      sessionStorage.setItem(appliedStorage, JSON.stringify([...next]));
      return next;
    });
  };

  const updateAction = (messageId: string, index: number, patch: Partial<AiAction>) => {
    persistMessages(messages.map((message) => message.id !== messageId ? message : {
      ...message,
      actions: message.actions?.map((action, actionIndex) => actionIndex === index ? { ...action, ...patch } : action),
    }));
  };

  const resolveProjectId = (action: AiAction, batchProjects = new Map<string, string>()) => {
    if (action.projectId && projectsById.has(action.projectId)) return action.projectId;
    const titleKey = normalizeTitle(action.projectTitle);
    if (!titleKey) return "";
    const existing = data.projects.find((project) => normalizeTitle(project.title) === titleKey);
    return batchProjects.get(titleKey) ?? createdProjectIds.current.get(titleKey) ?? existing?.id ?? "";
  };

  const executeAction = (action: AiAction, batchProjects = new Map<string, string>()) => {
    if (action.type === "create_project") {
      if (!action.title?.trim()) throw new Error("AI не вказав назву проєкту.");
      const id = createProject({ title: action.title, description: action.description ?? "", skill: action.skill ?? "Інше" });
      const titleKey = normalizeTitle(action.title);
      createdProjectIds.current.set(titleKey, id);
      batchProjects.set(titleKey, id);
      return;
    }
    if (action.type === "create_task") {
      if (!action.title?.trim()) throw new Error("AI не вказав назву задачі.");
      createTask({ title: action.title, projectId: resolveProjectId(action, batchProjects), targetMinutes: Math.min(240, Math.max(1, action.targetMinutes ?? 15)) });
      return;
    }
    if (action.type === "update_task") {
      const task = data.tasks.find((item) => item.id === action.taskId);
      if (!task) throw new Error("Цю задачу вже не знайдено.");
      const requestedProject = action.projectTitle ? resolveProjectId(action, batchProjects) : action.projectId === null ? INBOX_PROJECT_ID : action.projectId;
      updateTask(task.id, {
        title: action.title?.trim() || task.title,
        projectId: requestedProject === INBOX_PROJECT_ID || (requestedProject && (projectsById.has(requestedProject) || [...batchProjects.values()].includes(requestedProject))) ? requestedProject : task.projectId,
        targetMinutes: Math.min(240, Math.max(1, action.targetMinutes ?? task.targetMinutes)),
      });
      return;
    }
    if (!action.taskId || !data.tasks.some((task) => task.id === action.taskId)) throw new Error("Цю задачу вже не знайдено.");
    completeTask(action.taskId);
  };

  const applyAction = (messageId: string, index: number, action: AiAction) => {
    const key = `${messageId}:${index}`;
    if (applied.has(key)) return;
    try {
      executeAction(action);
      markApplied([key]);
      setEditingAction(null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const applyAll = (message: AiChatMessage) => {
    const pending = (message.actions ?? []).map((action, index) => ({ action, index, key: `${message.id}:${index}` })).filter((item) => !applied.has(item.key));
    if (!pending.length) return;
    requestConfirmation({
      title: "Застосувати всі пропозиції AI?",
      message: `${actionSummary(pending.map((item) => item.action))}. Перевір запропоновані зміни перед підтвердженням.`,
      confirmLabel: "Застосувати все",
      onConfirm: () => {
        const batchProjects = new Map<string, string>();
        const completedKeys: string[] = [];
        try {
          const ordered = orderAiActionsForExecution(pending.map((item) => ({ ...item, type: item.action.type })));
          for (const item of ordered) {
            executeAction(item.action, batchProjects);
            completedKeys.push(item.key);
          }
          markApplied(completedKeys);
          setEditingAction(null);
          setError(null);
        } catch (reason) {
          markApplied(completedKeys);
          setError(`Частину дій застосовано. ${reason instanceof Error ? reason.message : String(reason)}`);
        }
      },
    });
  };

  const requestReply = async (question: string, history: AiChatMessage[], currentMessages: AiChatMessage[]) => {
    const requestId = crypto.randomUUID();
    activeRequestId.current = requestId;
    setBusy(true);
    setError(null);
    setRetryContext({ question, history });
    try {
      const requestNow = Date.now();
      const reply = await askAi(provider, model, buildAiPrompt(data, requestNow, history, question), requestId);
      persistMessages([...currentMessages, { id: crypto.randomUUID(), role: "assistant", content: reply.message, actions: reply.actions }]);
      setRetryContext(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      activeRequestId.current = null;
      setBusy(false);
    }
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    if (!data.settings.aiConsentAccepted) return setError("Підтвердь передачу вибраного контексту перед першим запитом.");
    if (!hasKey) return setError(`Додай ${provider === "openai" ? "OpenAI" : "Gemini"} API-ключ у Налаштуваннях.`);
    const history = messages;
    const currentMessages = [...messages, { id: crypto.randomUUID(), role: "user" as const, content: question }];
    persistMessages(currentMessages);
    setInput("");
    await requestReply(question, history, currentMessages);
  };

  const stopRequest = async () => {
    if (activeRequestId.current) await cancelAiRequest(activeRequestId.current);
  };

  const retry = async () => {
    if (retryContext && !busy) await requestReply(retryContext.question, retryContext.history, messages);
  };

  const clearChat = () => {
    persistMessages([]);
    setApplied(new Set());
    setEditingAction(null);
    setRetryContext(null);
    setError(null);
    sessionStorage.removeItem(appliedStorage);
  };

  return <section className="page ai-page page-enter">
    <div className="page-title"><div><span className="eyebrow-dark">ЛОКАЛЬНИЙ КОНТЕКСТ · КОНТРОЛЬ ДІЙ</span><h1>AI-помічник</h1><p>Аналізує проєкти й фокус, допомагає планувати та пропонує зміни лише з підтвердженням.</p></div></div>
    <div className="ai-layout"><section className="card ai-chat">
      <div className="ai-chat-head"><div><span className={`ai-status ${keyStatus === null ? "checking" : !hasKey ? "offline" : ""}`}><i/> {provider === "openai" ? "GPT · OpenAI" : "Gemini · Google"} · {model}</span><strong>Чат E-task</strong></div><div className="ai-chat-head-actions"><button className="ai-settings-link" onClick={onOpenSettings}><SettingsIcon size={14}/> Налаштування</button><button onClick={clearChat} disabled={!messages.length && !error}>Очистити чат</button></div></div>
      <div className="ai-messages">
        {keyStatus && !hasKey && <div className="ai-setup-notice"><KeyRound size={20}/><div><strong>Підключи {provider === "openai" ? "GPT" : "Gemini"}</strong><span>API-ключ налаштовується один раз і зберігається у Windows.</span></div><button onClick={onOpenSettings}>Відкрити налаштування</button></div>}
        {!data.settings.aiConsentAccepted && <div className="ai-consent"><WandSparkles size={22}/><div><strong>Перед першим запитом</strong><span>AI отримає назви й статуси проєктів та задач, підсумки часу, останні повідомлення{data.settings.aiIncludeSessionHistory ? " та історію фокус-сесій" : " без історії фокус-сесій"}. API-ключ залишається у Windows.</span></div><button onClick={() => updateSettings({ aiConsentAccepted: true })}><Check size={15}/> Погоджуюсь</button></div>}
        {!messages.length && <div className="ai-welcome"><span><Sparkles size={27}/></span><h2>Що розібрати?</h2><p>Запитай про навантаження, наступний крок або попроси підготувати задачі. Жодна зміна не застосовується автоматично.</p><div className="ai-context-summary"><span>{data.projects.length} проєктів</span><span>{data.tasks.length} задач</span><span>{data.settings.aiIncludeSessionHistory ? `${data.sessions.length} сесій` : "Сесії вимкнено"}</span></div><div className="ai-suggestions">{["Проаналізуй мою продуктивність", "Що варто зробити наступним?", "Розбий активний проєкт на задачі"].map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div></div>}
        {messages.map((message) => <div className={`ai-message ${message.role}`} key={message.id}><span>{message.role === "assistant" ? <Bot size={16}/> : "Ви"}</span><div><p>{message.content}</p>{message.actions && message.actions.length > 1 && message.actions.some((_, index) => !applied.has(`${message.id}:${index}`)) && <div className="ai-actions-summary"><span>{actionSummary(message.actions.filter((_, index) => !applied.has(`${message.id}:${index}`)))}</span><button onClick={() => applyAll(message)}><WandSparkles size={15}/> Застосувати все</button></div>}{message.actions?.map((action, index) => {
          const key = `${message.id}:${index}`;
          const done = applied.has(key);
          const editing = editingAction === key;
          const newProjects = message.actions?.filter((item) => item.type === "create_project" && item.title?.trim()) ?? [];
          return <article className="ai-action-card" key={key}><div className="ai-action-main"><div><strong>{actionTitle(action, data)}</strong><small>{action.type.includes("task") && action.targetMinutes ? `Ціль: ${action.targetMinutes} хв` : "Перевір дію перед застосуванням"}</small></div>{editing && !done && <div className="ai-action-editor">
            {action.type !== "complete_task" && <label>Назва<input value={action.title ?? ""} onChange={(event) => updateAction(message.id, index, { title: event.target.value })}/></label>}
            {action.type === "create_project" && <><label>Навичка<input value={action.skill ?? "Інше"} onChange={(event) => updateAction(message.id, index, { skill: event.target.value })}/></label><label>Опис<input value={action.description ?? ""} onChange={(event) => updateAction(message.id, index, { description: event.target.value })}/></label></>}
            {(action.type === "create_task" || action.type === "update_task") && <><label>Проєкт<select value={action.projectId ? `id:${action.projectId}` : action.projectTitle ? `new:${action.projectTitle}` : ""} onChange={(event) => { const [kind, ...rest] = event.target.value.split(":"); const value = rest.join(":"); updateAction(message.id, index, kind === "id" ? { projectId: value, projectTitle: null } : kind === "new" ? { projectId: null, projectTitle: value } : { projectId: null, projectTitle: null }); }}><option value="">Без проєкту</option>{data.projects.filter((project) => project.id !== INBOX_PROJECT_ID).map((project) => <option value={`id:${project.id}`} key={project.id}>{project.title}</option>)}{newProjects.map((project) => <option value={`new:${project.title}`} key={`new:${project.title}`}>{project.title} · новий</option>)}</select></label><label>Ціль, хв<input type="number" min="1" max="240" value={action.targetMinutes ?? 15} onChange={(event) => updateAction(message.id, index, { targetMinutes: Number(event.target.value) })}/></label></>}
          </div>}</div><div className="ai-action-buttons">{!done && action.type !== "complete_task" && <button className="edit" onClick={() => setEditingAction(editing ? null : key)}>{editing ? <X size={15}/> : <Edit3 size={15}/>} {editing ? "Закрити" : "Змінити"}</button>}<button disabled={done} onClick={() => applyAction(message.id, index, action)}>{done ? <><Check size={15}/> Застосовано</> : <><Plus size={15}/> Підтвердити</>}</button></div></article>;
        })}</div></div>)}
        {busy && <div className="ai-message assistant"><span><Bot size={16}/></span><div className="ai-thinking"><LoaderCircle className="spin" size={17}/> Аналізую локальні дані…</div></div>}
        <div ref={messagesEnd}/>
      </div>
      {error && <div className="ai-error"><span>{error}</span>{retryContext && !busy && error !== "Запит зупинено." && <button onClick={() => void retry()}><RefreshCw size={14}/> Повторити</button>}</div>}
      <form className="ai-composer" onSubmit={send}><textarea rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Наприклад: проаналізуй цей тиждень і запропонуй три наступні задачі…"/>{busy ? <button className="stop" type="button" onClick={() => void stopRequest()} aria-label="Зупинити запит"><Square size={17}/></button> : <button type="submit" disabled={!input.trim() || !data.settings.aiConsentAccepted || keyStatus === null || !hasKey} aria-label="Надіслати"><Send size={18}/></button>}</form>
    </section></div>
  </section>;
}
