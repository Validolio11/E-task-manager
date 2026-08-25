import { useRef } from "react";
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
  const tasks = state.tasks.filter((task) => task.status === "todo").sort((a, b) => a.order - b.order);
  const drag = useRef({ pointerId: null as number | null, captureElement: null as Element | null, startX: 0, startY: 0, startScrollLeft: 0, moved: false, blockClick: false });

  return <nav
    className="dock"
    aria-label="Швидкий вибір задачі"
    onPointerDown={(event) => {
      const dock = event.currentTarget;
      if (!event.isPrimary || event.pointerType !== "mouse" || event.button !== 0 || dock.scrollWidth <= dock.clientWidth) return;
      const captureElement = (event.target as Element).closest("button") ?? dock;
      drag.current = { pointerId: event.pointerId, captureElement, startX: event.clientX, startY: event.clientY, startScrollLeft: dock.scrollLeft, moved: false, blockClick: false };
      captureElement.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (drag.current.pointerId !== event.pointerId) return;
      const distance = event.clientX - drag.current.startX;
      const verticalDistance = event.clientY - drag.current.startY;
      if (!drag.current.moved && (Math.abs(distance) < 6 || Math.abs(distance) <= Math.abs(verticalDistance))) return;
      drag.current.moved = true;
      event.currentTarget.classList.add("dragging");
      event.currentTarget.scrollLeft = drag.current.startScrollLeft - distance;
      event.preventDefault();
    }}
    onPointerUp={(event) => {
      if (drag.current.pointerId !== event.pointerId) return;
      const dock = event.currentTarget;
      const captureElement = drag.current.captureElement;
      drag.current.blockClick = drag.current.moved;
      drag.current.pointerId = null;
      drag.current.captureElement = null;
      dock.classList.remove("dragging");
      if (captureElement?.hasPointerCapture(event.pointerId)) captureElement.releasePointerCapture(event.pointerId);
      window.setTimeout(() => { drag.current.blockClick = false; }, 0);
    }}
    onPointerCancel={(event) => {
      if (drag.current.pointerId !== event.pointerId) return;
      drag.current.pointerId = null;
      drag.current.captureElement = null;
      drag.current.moved = false;
      drag.current.blockClick = false;
      event.currentTarget.classList.remove("dragging");
    }}
    onLostPointerCapture={(event) => {
      if (drag.current.pointerId !== event.pointerId) return;
      drag.current.pointerId = null;
      drag.current.captureElement = null;
      drag.current.moved = false;
      drag.current.blockClick = false;
      event.currentTarget.classList.remove("dragging");
    }}
    onClickCapture={(event) => {
      if (!drag.current.blockClick) return;
      event.preventDefault();
      event.stopPropagation();
      drag.current.blockClick = false;
    }}
    onDragStart={(event) => event.preventDefault()}
    onWheel={(event) => {
      const dock = event.currentTarget;
      if (dock.scrollWidth <= dock.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      dock.scrollLeft += event.deltaY;
    }}
  >
    <button className="all-tasks" type="button" onClick={onOpenAll} aria-label="Відкрити всі задачі"><ListTodo/><span><b>Усі задачі</b><small>{tasks.length} доступно</small></span></button>
    {tasks.map((task) => {
      const selected = task.id === state.selectedTaskId;
      const active = task.id === state.activeSession?.taskId;
      const paused = active && state.activeSession?.status === "paused";
      const running = active && state.activeSession?.status === "running";
      return <button className={`task ${selected ? "selected" : ""} ${paused ? "paused" : ""} ${running ? "active" : ""}`} type="button" aria-current={selected ? "true" : undefined} onClick={() => selectTask(task.id)} key={task.id}>
        {paused || running ? <Pause aria-hidden="true"/> : <TaskIcon icon={task.icon} emoji={task.emoji}/>}<span><b>{task.title}</b><small>{paused ? `На паузі · ${formatTimer(trackedMs(state, task.id, now))}` : running ? `У фокусі · ${formatTimer(trackedMs(state, task.id, now))}` : selected ? `Готова до запуску · ${task.plannedMinutes} хв` : `${task.plannedMinutes} хв`}</small></span>
      </button>;
    })}
  </nav>;
}
