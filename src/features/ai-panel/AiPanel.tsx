import { BrainCircuit, Send, Settings, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AiMessage } from "../../domain/types";
import { useAppStore } from "../../store/AppStore";
import { requestAiReply } from "./ai-client";
import { loadAiSettings, saveAiSettings } from "./ai-settings";
import { AiSettingsDialog } from "./AiSettingsDialog";
import "./ai-panel.css";

export function AiPanel({ onClose }: { onClose: () => void }) {
  const { state, addAiMessage } = useAppStore();
  const [value, setValue] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(loadAiSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [state.aiMessages, thinking]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || thinking) return;
    const pendingMessage: AiMessage = { id: "pending", role: "user", content: text, createdAt: new Date().toISOString() };
    addAiMessage({ role: "user", content: text });
    setValue(""); setThinking(true); setError("");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      let answer: string;
      if (settings.mode === "api") {
        answer = await requestAiReply(settings, [...state.aiMessages, pendingMessage], state.tasks, state.selectedTaskId, controller.signal);
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        const openTasks = state.tasks.filter((task) => task.status === "todo");
        answer = openTasks.length
          ? `Зараз у тебе ${openTasks.length} активні задачі. Я б почав із «${openTasks.find((task) => task.id === state.selectedTaskId)?.title ?? openTasks[0].title}» і залишив один короткий фокус без перемикання.`
          : "Черга порожня. Додай один конкретний наступний крок — я допоможу сформулювати його коротше.";
      }
      if (controller.signal.aborted) return;
      addAiMessage({ role: "assistant", content: answer });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не вдалося отримати відповідь AI.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setThinking(false);
    }
  };
  return <aside className="ai-panel" role="dialog" aria-modal="true" aria-label="AI-помічник">
    <header><span><BrainCircuit/></span><div className="ai-header-copy"><strong>AI-помічник</strong><small>{settings.mode === "api" ? `API · ${settings.model}` : "Локальний режим"} · без зміни задач</small></div><div className="ai-header-actions"><button type="button" onClick={() => setSettingsOpen(true)} aria-label="Налаштування AI"><Settings/></button><button type="button" onClick={onClose} aria-label="Закрити AI-помічник"><X/></button></div></header>
    <div className="ai-messages" ref={scrollRef}>
      {!state.aiMessages.length && <div className="ai-welcome"><span><Sparkles/></span><h2>Що розібрати?</h2><p>Постав запитання про поточний фокус або попроси допомогти визначити наступний крок.</p><button type="button" onClick={() => setValue("Що варто зробити наступним?")}>Запропонуй наступний крок</button></div>}
      {state.aiMessages.map((message) => <article className={message.role} key={message.id}><span>{message.role === "assistant" ? <BrainCircuit/> : "Ви"}</span><p>{message.content}</p></article>)}
      {thinking && <article className="assistant thinking"><span><BrainCircuit/></span><p>Аналізую поточну чергу…</p></article>}
    </div>
    {error && <div className="ai-request-error" role="alert"><span>{error}</span><button type="button" onClick={() => setSettingsOpen(true)}>Налаштування</button></div>}
    <form className="ai-composer" onSubmit={submit}><textarea rows={2} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Наприклад: що зробити наступним?" aria-label="Повідомлення AI"/><button type="submit" aria-label="Надіслати" disabled={!value.trim() || thinking}><Send/></button></form>
    {settingsOpen && <AiSettingsDialog
      initial={settings}
      onClose={() => setSettingsOpen(false)}
      onSave={(next) => {
        saveAiSettings(next);
        setSettings(next);
        setSettingsOpen(false);
        setError("");
      }}
    />}
  </aside>;
}
