import { Clock3, Edit3, MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Task } from "../../domain";

export type TaskMenuRequest = {
  taskId: string;
  anchor: HTMLElement;
  point?: { x: number; y: number };
};

export type OpenTaskMenu = (taskId: string, anchor: HTMLElement, point?: { x: number; y: number }) => void;

type Props = {
  request: TaskMenuRequest;
  task: Task;
  onClose: (restoreFocus: boolean) => void;
  onEditTask: (returnFocus: HTMLElement) => void;
  onEditTime: (returnFocus: HTMLElement) => void;
  onDelete: (returnFocus: HTMLElement) => void;
};

const viewportMargin = 8;

export function TaskMenuTrigger({ task, open, openMenu }: { task: Task; open: boolean; openMenu: OpenTaskMenu }) {
  return <button
    className="task-menu-trigger"
    type="button"
    aria-label={`Дії задачі ${task.title}`}
    aria-haspopup="menu"
    aria-expanded={open}
    title="Дії задачі"
    onClick={(event) => openMenu(task.id, event.currentTarget)}
  ><MoreVertical size={17} aria-hidden="true"/></button>;
}

export function TaskContextMenu({ request, task, onClose, onEditTask, onEditTime, onDelete }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });

  const close = (restoreFocus: boolean) => {
    onClose(restoreFocus);
    if (restoreFocus) window.requestAnimationFrame(() => request.anchor.isConnected && request.anchor.focus());
  };

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const anchorRect = request.anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const pointerOpen = request.point && (request.point.x !== 0 || request.point.y !== 0);
    const preferredLeft = pointerOpen ? request.point!.x : anchorRect.right - menuRect.width;
    const preferredTop = pointerOpen ? request.point!.y : anchorRect.bottom + 6;
    const aboveTop = (pointerOpen ? request.point!.y : anchorRect.top) - menuRect.height - 6;
    const top = preferredTop + menuRect.height > window.innerHeight - viewportMargin ? aboveTop : preferredTop;
    setPosition({
      left: Math.min(Math.max(viewportMargin, preferredLeft), Math.max(viewportMargin, window.innerWidth - menuRect.width - viewportMargin)),
      top: Math.min(Math.max(viewportMargin, top), Math.max(viewportMargin, window.innerHeight - menuRect.height - viewportMargin)),
      ready: true,
    });
    window.requestAnimationFrame(() => menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
  }, [request]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || menuRef.current?.contains(target) || request.anchor.contains(target)) return;
      close(false);
    };
    const dismiss = () => close(false);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.visualViewport?.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.visualViewport?.removeEventListener("resize", dismiss);
    };
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      items[(current + direction + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && document.activeElement instanceof HTMLButtonElement) {
      event.preventDefault();
      document.activeElement.click();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const menu = menuRef.current;
      const focusable = [...document.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !menu?.contains(element) && element.getClientRects().length > 0);
      const anchorIndex = focusable.indexOf(request.anchor);
      const target = anchorIndex >= 0 && focusable.length
        ? focusable[(anchorIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]
        : request.anchor;
      onClose(false);
      window.requestAnimationFrame(() => target.focus());
    }
  };

  const run = (action: (returnFocus: HTMLElement) => void) => {
    onClose(false);
    action(request.anchor);
  };

  return createPortal(
    <div
      ref={menuRef}
      className="task-context-menu"
      role="menu"
      aria-label={`Дії задачі ${task.title}`}
      style={{ left: position.left, top: position.top, visibility: position.ready ? "visible" : "hidden" }}
      onKeyDown={handleKeyDown}
    >
      <div className="task-context-heading" role="presentation"><strong>{task.title}</strong><span>Ціль: {task.targetMinutes} хв</span></div>
      <button type="button" role="menuitem" onClick={() => run(onEditTask)}><Edit3 size={16}/><span><strong>Редагувати задачу</strong><small>Назва та проєкт</small></span></button>
      <button type="button" role="menuitem" onClick={() => run(onEditTime)}><Clock3 size={16}/><span><strong>Редагувати час</strong><small>Змінити ціль фокусу</small></span></button>
      <div className="task-context-separator" role="separator"/>
      <button className="danger" type="button" role="menuitem" onClick={() => run(onDelete)}><Trash2 size={16}/><span><strong>Видалити задачу</strong><small>Разом зі статистикою</small></span></button>
    </div>,
    document.body,
  );
}
