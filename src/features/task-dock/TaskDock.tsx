import { useEffect, useRef } from "react";
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
  const dockRef = useRef<HTMLElement>(null);
  const drag = useRef({ pointerId: null as number | null, captureElement: null as Element | null, startX: 0, startY: 0, startScrollLeft: 0, lastX: 0, lastMoveAt: 0, velocity: 0, moved: false, blockClick: false });
  const inertia = useRef({ frame: null as number | null, dock: null as HTMLElement | null });

  const stopInertia = () => {
    if (inertia.current.frame !== null) cancelAnimationFrame(inertia.current.frame);
    inertia.current.dock?.classList.remove("gliding");
    inertia.current = { frame: null, dock: null };
  };

  const startInertia = (dock: HTMLElement, initialVelocity: number) => {
    stopInertia();
    if (Math.abs(initialVelocity) < 0.04 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let velocity = Math.max(-2.5, Math.min(2.5, initialVelocity));
    let previousTime = performance.now();
    dock.classList.add("gliding");
    inertia.current.dock = dock;
    const animate = (time: number) => {
      const elapsed = Math.min(32, Math.max(1, time - previousTime));
      previousTime = time;
      const maximum = Math.max(0, dock.scrollWidth - dock.clientWidth);
      const previousPosition = dock.scrollLeft;
      dock.scrollLeft = Math.max(0, Math.min(maximum, previousPosition + velocity * elapsed));
      const reachedEdge = dock.scrollLeft === previousPosition && (dock.scrollLeft === 0 || dock.scrollLeft === maximum);
      velocity *= Math.pow(0.94, elapsed / 16.67);
      if (Math.abs(velocity) < 0.018 || reachedEdge) {
        dock.classList.remove("gliding");
        inertia.current = { frame: null, dock: null };
        return;
      }
      inertia.current.frame = requestAnimationFrame(animate);
    };
    inertia.current.frame = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const handleWheel = (event: WheelEvent) => {
      if (dock.scrollWidth <= dock.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const maximum = dock.scrollWidth - dock.clientWidth;
      const canConsume = (event.deltaY > 0 && dock.scrollLeft < maximum) || (event.deltaY < 0 && dock.scrollLeft > 0);
      if (!canConsume) return;
      stopInertia();
      event.preventDefault();
      dock.scrollLeft = Math.max(0, Math.min(maximum, dock.scrollLeft + event.deltaY));
    };
    dock.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      dock.removeEventListener("wheel", handleWheel);
      stopInertia();
    };
  }, []);

  return <nav
    ref={dockRef}
    className="dock"
    aria-label="Швидкий вибір задачі"
    onPointerDown={(event) => {
      const dock = event.currentTarget;
      if (!event.isPrimary || event.pointerType !== "mouse" || event.button !== 0 || dock.scrollWidth <= dock.clientWidth) return;
      stopInertia();
      const captureElement = (event.target as Element).closest("button") ?? dock;
      drag.current = { pointerId: event.pointerId, captureElement, startX: event.clientX, startY: event.clientY, startScrollLeft: dock.scrollLeft, lastX: event.clientX, lastMoveAt: performance.now(), velocity: 0, moved: false, blockClick: false };
      captureElement.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (drag.current.pointerId !== event.pointerId) return;
      const distance = event.clientX - drag.current.startX;
      const verticalDistance = event.clientY - drag.current.startY;
      if (!drag.current.moved && (Math.abs(distance) < 6 || Math.abs(distance) <= Math.abs(verticalDistance))) return;
      drag.current.moved = true;
      const moveTime = performance.now();
      const elapsed = Math.max(1, moveTime - drag.current.lastMoveAt);
      const measuredVelocity = -(event.clientX - drag.current.lastX) / elapsed;
      drag.current.velocity = drag.current.velocity * 0.65 + measuredVelocity * 0.35;
      drag.current.lastX = event.clientX;
      drag.current.lastMoveAt = moveTime;
      event.currentTarget.classList.add("dragging");
      event.currentTarget.scrollLeft = drag.current.startScrollLeft - distance;
      event.preventDefault();
    }}
    onPointerUp={(event) => {
      if (drag.current.pointerId !== event.pointerId) return;
      const dock = event.currentTarget;
      const captureElement = drag.current.captureElement;
      const releaseDelay = performance.now() - drag.current.lastMoveAt;
      const releaseVelocity = releaseDelay > 100 ? 0 : drag.current.velocity * Math.max(0, 1 - releaseDelay / 140);
      drag.current.blockClick = drag.current.moved;
      drag.current.pointerId = null;
      drag.current.captureElement = null;
      dock.classList.remove("dragging");
      if (captureElement?.hasPointerCapture(event.pointerId)) captureElement.releasePointerCapture(event.pointerId);
      if (drag.current.moved) startInertia(dock, releaseVelocity);
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
