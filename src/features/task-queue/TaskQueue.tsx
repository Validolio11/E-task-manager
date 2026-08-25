import { Check, CirclePlay, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../../domain/types";
import { TaskIcon } from "../../shared/TaskIcon";
import { useAppStore } from "../../store/AppStore";
import "./task-queue.css";

type Props = { onClose: () => void; onAdd: () => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void };

export function TaskQueue({ onClose, onAdd, onEdit, onDelete }: Props) {
  const { state, selectTask, startFocus, completeTask, reopenTask } = useAppStore();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!panel.contains(document.activeElement)) panel.querySelector<HTMLElement>("input,button")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('button,input,[tabindex]:not([tabindex="-1"])')]
        .filter((item) => !item.hasAttribute("disabled") && item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, []);
  useEffect(() => {
    if (!menuId) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".task-popover,.queue-more")) return;
      setMenuId(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMenuId(null);
    };
    const dismissOnLayoutChange = () => setMenuId(null);
    document.addEventListener("pointerdown", dismissOnPointerDown, true);
    document.addEventListener("keydown", dismissOnEscape, true);
    document.addEventListener("scroll", dismissOnLayoutChange, true);
    window.addEventListener("resize", dismissOnLayoutChange);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown, true);
      document.removeEventListener("keydown", dismissOnEscape, true);
      document.removeEventListener("scroll", dismissOnLayoutChange, true);
      window.removeEventListener("resize", dismissOnLayoutChange);
    };
  }, [menuId]);
  const normalized = query.trim().toLocaleLowerCase("uk-UA");
  const tasks = useMemo(() => state.tasks.filter((task) => !normalized || `${task.title} ${task.project}`.toLocaleLowerCase("uk-UA").includes(normalized)).sort((a, b) => a.order - b.order), [normalized, state.tasks]);
  const open = tasks.filter((task) => task.status === "todo");
  const completed = tasks.filter((task) => task.status === "completed");
  const menuTask = menuId ? state.tasks.find((task) => task.id === menuId) ?? null : null;
  const openMenu = (taskId: string, button: HTMLButtonElement) => {
    if (menuId === taskId) { setMenuId(null); return; }
    const rect = button.getBoundingClientRect();
    const menuHeight = 140;
    const menuWidth = 168;
    const top = rect.bottom + menuHeight + 8 <= window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - menuHeight - 8);
    setMenuPosition({ left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)), top });
    setMenuId(taskId);
  };

  return <aside ref={panelRef} className="queue-panel" role="dialog" aria-modal="true" aria-label="Усі задачі">
    <header><div><span>ЗАВДАННЯ</span><h2>Усі задачі</h2></div><button type="button" onClick={onClose} aria-label="Закрити список задач"><X/></button></header>
    <div className="queue-search"><Search/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук задач" aria-label="Пошук задач"/><button type="button" onClick={onAdd}><Plus/>Додати</button></div>
    <div className="queue-scroll">
      <section><div className="queue-section-title"><span>ДАЛІ</span><strong>{open.length}</strong></div>{open.map((task) => {
        const active = state.activeSession?.taskId === task.id;
        const running = active && state.activeSession?.status === "running";
        const paused = active && state.activeSession?.status === "paused";
        return <article className={`${state.selectedTaskId === task.id ? "selected" : ""} ${running ? "active" : ""} ${paused ? "paused" : ""}`} key={task.id}>
          <button className="queue-select" type="button" onClick={() => { selectTask(task.id); onClose(); }}><span className="queue-icon"><TaskIcon icon={task.icon} emoji={task.emoji}/></span><span><strong>{task.title}</strong><small>{task.project || "Без проєкту"} · {task.plannedMinutes} хв</small></span></button>
          <button type="button" className="queue-play" onClick={() => { startFocus(task.id); onClose(); }} aria-label={`Почати ${task.title}`}><CirclePlay/></button>
          <button type="button" className="queue-more" onClick={(event) => openMenu(task.id, event.currentTarget)} aria-label={`Дії задачі ${task.title}`} aria-haspopup="menu" aria-expanded={menuId === task.id}><MoreHorizontal/></button>
        </article>;
      })}</section>
      {completed.length > 0 && <section><div className="queue-section-title"><span>ЗАВЕРШЕНІ</span><strong>{completed.length}</strong></div>{completed.map((task) => <article className="completed" key={task.id}><div className="queue-select"><span className="queue-icon"><Check/></span><span><strong>{task.title}</strong><small>{task.project || "Без проєкту"}</small></span></div><button type="button" className="queue-play" onClick={() => reopenTask(task.id)} aria-label={`Повернути ${task.title}`}><RotateCcw/></button><button type="button" className="queue-more" onClick={() => onDelete(task)} aria-label={`Видалити ${task.title}`}><Trash2/></button></article>)}</section>}
      {!tasks.length && <div className="queue-empty">{state.tasks.length ? "За цим запитом задач немає. Очисть пошук, щоб побачити всю чергу." : "Черга порожня. Додай один конкретний наступний крок."}</div>}
    </div>
    {menuTask && <div className="task-popover" role="menu" style={menuPosition}><button role="menuitem" onClick={() => { setMenuId(null); onEdit(menuTask); }}><Pencil/>Редагувати</button><button role="menuitem" onClick={() => { setMenuId(null); completeTask(menuTask.id); }}><Check/>Завершити</button><button role="menuitem" className="danger-item" onClick={() => { setMenuId(null); onDelete(menuTask); }}><Trash2/>Видалити</button></div>}
  </aside>;
}
