import { BrainCircuit, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppStore } from "../../store/AppStore";
import "./ai-panel.css";

export function AiPanel({ onClose }: { onClose: () => void }) {
  const { state, addAiMessage } = useAppStore();
  const [value, setValue] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [state.aiMessages, thinking]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || thinking) return;
    addAiMessage({ role: "user", content: text });
    setValue(""); setThinking(true);
    window.setTimeout(() => {
      const openTasks = state.tasks.filter((task) => task.status === "todo");
      const answer = openTasks.length
        ? `Зараз у тебе ${openTasks.length} активні задачі. Я б почав із «${openTasks.find((task) => task.id === state.selectedTaskId)?.title ?? openTasks[0].title}» і залишив один короткий фокус без перемикання.`
        : "Черга порожня. Додай один конкретний наступний крок — я допоможу сформулювати його коротше.";
      addAiMessage({ role: "assistant", content: answer });
      setThinking(false);
    }, 550);
  };
  return <aside className="ai-panel" role="dialog" aria-modal="true" aria-label="AI-помічник">
    <header><span><BrainCircuit/></span><div><strong>AI-помічник</strong><small>Локальний режим · без зміни задач</small></div><button type="button" onClick={onClose} aria-label="Закрити AI-помічник"><X/></button></header>
    <div className="ai-messages" ref={scrollRef}>
      {!state.aiMessages.length && <div className="ai-welcome"><span><Sparkles/></span><h2>Що розібрати?</h2><p>Постав запитання про поточний фокус або попроси допомогти визначити наступний крок.</p><button type="button" onClick={() => setValue("Що варто зробити наступним?")}>Запропонуй наступний крок</button></div>}
      {state.aiMessages.map((message) => <article className={message.role} key={message.id}><span>{message.role === "assistant" ? <BrainCircuit/> : "Ви"}</span><p>{message.content}</p></article>)}
      {thinking && <article className="assistant thinking"><span><BrainCircuit/></span><p>Аналізую поточну чергу…</p></article>}
    </div>
    <form className="ai-composer" onSubmit={submit}><textarea rows={2} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Наприклад: що зробити наступним?" aria-label="Повідомлення AI"/><button type="submit" aria-label="Надіслати" disabled={!value.trim() || thinking}><Send/></button></form>
  </aside>;
}
