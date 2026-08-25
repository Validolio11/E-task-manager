import { ListTodo, Pause } from "lucide-react";
import { trackedMs } from "../../domain/state";
import { TaskIcon } from "../../shared/TaskIcon";
import { formatTimer } from "../../shared/format";
import { useNow } from "../../shared/useNow";
import { useAppStore } from "../../store/AppStore";
import "./task-dock.css";

export function TaskDock({ onOpenAll }: { onOpenAll: () => void }) {
  const { state, selectTask } = useAppStore();
  const now = useNow(state.activeSession?.status === "running");
  const tasks = state.tasks.filter((task) => task.status === "todo").sort((a, b) => a.order - b.order).slice(0, 4);

  return <nav className="dock" aria-label="Швидкий вибір задачі">
    {tasks.map((task) => {
      const selected = task.id === state.selectedTaskId;
      const active = task.id === state.activeSession?.taskId;
      const paused = active && state.activeSession?.status === "paused";
      const running = active && state.activeSession?.status === "running";
      return <button className={`task ${selected ? "selected" : ""} ${paused ? "paused" : ""} ${running ? "active" : ""}`} type="button" aria-current={selected ? "true" : undefined} onClick={() => selectTask(task.id)} key={task.id}>
        {paused || running ? <Pause aria-hidden="true"/> : <TaskIcon icon={task.icon} emoji={task.emoji}/>}<span><b>{task.title}</b><small>{paused ? `На паузі · ${formatTimer(trackedMs(state, task.id, now))}` : running ? `У фокусі · ${formatTimer(trackedMs(state, task.id, now))}` : selected ? `Готова до запуску · ${task.plannedMinutes} хв` : `${task.plannedMinutes} хв`}</small></span>
      </button>;
    })}
    <button className="all-tasks" type="button" onClick={onOpenAll} aria-label="Відкрити всі задачі"><ListTodo/><span><b>Усі задачі</b><small>{state.tasks.filter((task) => task.status === "todo").length} доступно</small></span></button>
  </nav>;
}
