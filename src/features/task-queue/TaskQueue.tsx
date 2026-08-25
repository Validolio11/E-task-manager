import { Check, CirclePlay, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Task } from "../../domain/types";
import { TaskIcon } from "../../shared/TaskIcon";
import { useAppStore } from "../../store/AppStore";
import "./task-queue.css";

type Props = { onClose: () => void; onAdd: () => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void };

export function TaskQueue({ onClose, onAdd, onEdit, onDelete }: Props) {
  const { state, selectTask, startFocus, completeTask, reopenTask } = useAppStore();
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const normalized = query.trim().toLocaleLowerCase("uk-UA");
  const tasks = useMemo(() => state.tasks.filter((task) => !normalized || `${task.title} ${task.project}`.toLocaleLowerCase("uk-UA").includes(normalized)).sort((a, b) => a.order - b.order), [normalized, state.tasks]);
  const open = tasks.filter((task) => task.status === "todo");
  const completed = tasks.filter((task) => task.status === "completed");

  return <aside className="queue-panel" role="dialog" aria-modal="true" aria-label="Усі задачі">
    <header><div><span>ЗАВДАННЯ</span><h2>Усі задачі</h2></div><button type="button" onClick={onClose} aria-label="Закрити список задач"><X/></button></header>
    <div className="queue-search"><Search/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук задач" aria-label="Пошук задач"/><button type="button" onClick={onAdd}><Plus/>Додати</button></div>
    <div className="queue-scroll">
      <section><div className="queue-section-title"><span>ДАЛІ</span><strong>{open.length}</strong></div>{open.map((task) => {
        const active = state.activeSession?.taskId === task.id;
        return <article className={`${state.selectedTaskId === task.id ? "selected" : ""} ${active ? "active" : ""}`} key={task.id}>
          <button className="queue-select" type="button" onClick={() => { selectTask(task.id); onClose(); }}><span className="queue-icon"><TaskIcon icon={task.icon} emoji={task.emoji}/></span><span><strong>{task.title}</strong><small>{task.project || "Без проєкту"} · {task.plannedMinutes} хв</small></span></button>
          <button type="button" className="queue-play" onClick={() => startFocus(task.id)} aria-label={`Почати ${task.title}`}><CirclePlay/></button>
          <button type="button" className="queue-more" onClick={() => setMenuId((id) => id === task.id ? null : task.id)} aria-label={`Дії задачі ${task.title}`}><MoreHorizontal/></button>
          {menuId === task.id && <div className="task-popover"><button onClick={() => onEdit(task)}><Pencil/>Редагувати</button><button onClick={() => completeTask(task.id)}><Check/>Завершити</button><button className="danger-item" onClick={() => onDelete(task)}><Trash2/>Видалити</button></div>}
        </article>;
      })}</section>
      {completed.length > 0 && <section><div className="queue-section-title"><span>ЗАВЕРШЕНІ</span><strong>{completed.length}</strong></div>{completed.map((task) => <article className="completed" key={task.id}><div className="queue-select"><span className="queue-icon"><Check/></span><span><strong>{task.title}</strong><small>{task.project || "Без проєкту"}</small></span></div><button type="button" className="queue-play" onClick={() => reopenTask(task.id)} aria-label={`Повернути ${task.title}`}><RotateCcw/></button><button type="button" className="queue-more" onClick={() => onDelete(task)} aria-label={`Видалити ${task.title}`}><Trash2/></button></article>)}</section>}
      {!tasks.length && <div className="queue-empty">Нічого не знайдено</div>}
    </div>
  </aside>;
}
