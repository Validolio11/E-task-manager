import { BrainCircuit, Clock3, Plus } from "lucide-react";
import { todayMs } from "../../domain/state";
import { useAppStore } from "../../store/AppStore";
import { formatCompactDuration } from "../../shared/format";
import { LogoMark } from "../../shared/LogoMark";
import { useNow } from "../../shared/useNow";
import "./header.css";

export function AppHeader({ onAddTask, onOpenAi }: { onAddTask: () => void; onOpenAi: () => void }) {
  const { state } = useAppStore();
  const now = useNow(state.activeSession?.status === "running");
  return <header className="app-header">
    <div className="brand"><LogoMark className="brand-logo"/><b>E-task</b></div>
    <div className="today"><Clock3/><span>Сьогодні · {formatCompactDuration(todayMs(state, now))}</span></div>
    <button className="ai-button" type="button" onClick={onOpenAi} aria-label="Відкрити AI-помічника"><BrainCircuit/><span>AI-помічник</span></button>
    <button className="round-button" type="button" onClick={onAddTask} aria-label="Додати задачу"><Plus/></button>
  </header>;
}
