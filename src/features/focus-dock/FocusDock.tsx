import { Check, Pause, Pencil, Play } from "lucide-react";
import { trackedMs } from "../../domain/state";
import type { Task } from "../../domain/types";
import { formatTimer } from "../../shared/format";
import { TaskIcon } from "../../shared/TaskIcon";
import { useNow } from "../../shared/useNow";
import { useAppStore } from "../../store/AppStore";
import "./focus-dock.css";

type Props = {
  task: Task | null;
  onEdit: (task: Task) => void;
  onAdd: () => void;
};

export function FocusDock({ task, onEdit, onAdd }: Props) {
  const { state, startFocus, pauseFocus, completeTask } = useAppStore();
  const running = state.activeSession?.status === "running";
  const now = useNow(running);

  if (!task) return <section className="focus empty-focus">
    <div className="eyebrow"><div className="focus-icon"><Check/></div><div className="state-label">ГОТОВО</div></div>
    <h1>Задач поки немає</h1>
    <p className="meta">Додай один конкретний наступний крок</p>
    <div className="actions"><button className="start" type="button" onClick={onAdd}><Play/><span className="start-label">Додати задачу</span></button></div>
  </section>;

  const isActive = state.activeSession?.taskId === task.id;
  const isRunning = isActive && state.activeSession?.status === "running";
  const isPaused = isActive && state.activeSession?.status === "paused";
  const elapsed = trackedMs(state, task.id, now);
  const stateText = isRunning ? "У ФОКУСІ" : isPaused ? "НА ПАУЗІ" : "ГОТОВА ДО ФОКУСУ";
  const value = isActive ? formatTimer(elapsed) : `${task.plannedMinutes} хв`;
  const hint = isRunning
    ? `Ціль ${task.plannedMinutes} хв · відлік триває`
    : isPaused
      ? "Час збережено · продовжуй, коли будеш готовий"
      : state.activeSession?.status === "running"
        ? `Поточний фокус продовжується · запуск перемкне задачу`
        : "Вибір задачі не запускає таймер";

  return <section className="focus" aria-labelledby="task-title">
    <div className={`eyebrow ${isRunning ? "running" : ""} ${isPaused ? "paused" : ""}`}><div className="focus-icon"><TaskIcon icon={task.icon} emoji={task.emoji} size={19}/></div><div className="state-label">{stateText}</div></div>
    <h1 id="task-title">{task.title}</h1>
    <p className="meta">{task.project || "Без проєкту"} · заплановано {task.plannedMinutes} хв</p>
    <div className="planned" aria-live="off">{value}</div>
    <div className="hint">{hint}</div>
    <div className="actions">
      {isRunning
        ? <button className="start" type="button" onClick={pauseFocus}><Pause/><span className="start-label">Призупинити</span><span className="start-duration">{task.plannedMinutes} хв</span></button>
        : <button className="start" type="button" onClick={() => startFocus(task.id)}><Play/><span className="start-label">{isPaused ? "Продовжити" : "Почати фокус"}</span><span className="start-duration">{task.plannedMinutes} хв</span></button>}
      <button className="icon-button" type="button" onClick={() => onEdit(task)} aria-label="Редагувати задачу"><Pencil/></button>
    </div>
    {isActive && <button className="complete-link" type="button" onClick={() => completeTask(task.id)}><Check/>Завершити задачу</button>}
  </section>;
}
