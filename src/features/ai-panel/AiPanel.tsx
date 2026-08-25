import { BrainCircuit, Send, Settings, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AiMessage } from "../../domain/types";
import { useAppStore } from "../../store/AppStore";
import { requestAiReply } from "./ai-client";
import { AI_LIMITS } from "./ai-client";
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
  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const safeMessages = Array.isArray(state.aiMessages)
    ? state.aiMessages.filter((message): message is AiMessage => Boolean(message) && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    : [];
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [safeMessages.length, thinking]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    composerRef.current?.focus();
    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && panelRef.current && !panelRef.current.contains(event.target)) composerRef.current?.focus();
    };
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const closePanel = () => { requestRef.current?.abort(); onClose(); };
  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !settingsOpen) {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
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
        answer = await requestAiReply(settings, [...safeMessages, pendingMessage], state.tasks, state.selectedTaskId, controller.signal);
      } else {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 420);
          controller.signal.addEventListener("abort", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
        });
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
  return <aside ref={panelRef} className="ai-panel" role="dialog" aria-modal="true" aria-label="AI-помічник" onKeyDown={handlePanelKeyDown}>
    <header><span><BrainCircuit/></span><div className="ai-header-copy"><strong>AI-помічник</strong><small>{settings.mode === "api" ? `API · ${settings.model || "без моделі"} · задачі ${settings.shareTaskContext ? "дозволені" : "приховані"}` : "Локальний режим"} · без зміни задач</small></div><div className="ai-header-actions"><button type="button" onClick={() => setSettingsOpen(true)} aria-label="Налаштування AI"><Settings/></button><button type="button" onClick={closePanel} aria-label="Закрити AI-помічник"><X/></button></div></header>
    <div className="ai-messages" ref={scrollRef}>
      {!safeMessages.length && <div className="ai-welcome"><span><Sparkles/></span><h2>Що розібрати?</h2><p>Постав запитання про поточний фокус або попроси допомогти визначити наступний крок.</p><button type="button" onClick={() => setValue("Що варто зробити наступним?")}>Запропонуй наступний крок</button></div>}
      {safeMessages.map((message, index) => <article className={message.role} key={message.id || `${message.role}-${index}`}><span>{message.role === "assistant" ? <BrainCircuit/> : "Ви"}</span><p>{message.content.slice(0, AI_LIMITS.responseCharacters)}</p></article>)}
      {thinking && <article className="assistant thinking"><span><BrainCircuit/></span><p>Аналізую поточну чергу…</p></article>}
    </div>
    {error && <div className="ai-request-error" role="alert"><span>{error}</span><button type="button" onClick={() => setSettingsOpen(true)}>Налаштування</button></div>}
    <form className="ai-composer" onSubmit={submit}><textarea ref={composerRef} rows={2} maxLength={AI_LIMITS.inputCharacters} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Наприклад: що зробити наступним?" aria-label="Повідомлення AI"/><button type="submit" aria-label="Надіслати" disabled={!value.trim() || thinking}><Send/></button></form>
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
