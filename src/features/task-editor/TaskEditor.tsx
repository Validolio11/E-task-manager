import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { SmilePlus, X } from "lucide-react";
import type { Task, TaskInput } from "../../domain/types";
import { Dialog } from "../../shared/Dialog";
import { resolveTaskEmoji } from "../../shared/TaskIcon";
import "./task-editor.css";

const loadEmojiCatalog = () => import("./EmojiCatalog");
const EmojiCatalog = lazy(loadEmojiCatalog);

if (typeof window !== "undefined") {
  const warmEmojiCatalog = () => { void loadEmojiCatalog(); };
  if ("requestIdleCallback" in window) window.requestIdleCallback(warmEmojiCatalog, { timeout: 1600 });
  else globalThis.setTimeout(warmEmojiCatalog, 700);
}

export function TaskEditor({ task, onClose, onSave }: { task: Task | null; onClose: () => void; onSave: (input: TaskInput) => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [project, setProject] = useState(task?.project ?? "");
  const [plannedMinutes, setPlannedMinutes] = useState(task?.plannedMinutes ?? 30);
  const [emoji, setEmoji] = useState(task ? resolveTaskEmoji(task.icon, task.emoji) : "📝");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; minutes?: string }>({});
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const mountPicker = () => setPickerMounted(true);
    const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number; cancelIdleCallback?: (handle: number) => void };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(mountPicker, { timeout: 500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timeoutId = globalThis.setTimeout(mountPicker, 250);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);
  useEffect(() => { setTitle(task?.title ?? ""); setProject(task?.project ?? ""); setPlannedMinutes(task?.plannedMinutes ?? 30); setEmoji(task ? resolveTaskEmoji(task.icon, task.emoji) : "📝"); setPickerOpen(false); setErrors({}); }, [task]);
  useEffect(() => {
    if (!pickerOpen) return;
    requestAnimationFrame(() => pickerRef.current?.querySelector<HTMLElement>("[data-emoji-initial-focus]")?.focus());
  }, [pickerOpen]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: { title?: string; minutes?: string } = {};
    if (!title.trim()) nextErrors.title = "Введіть коротку назву задачі";
    if (!Number.isInteger(plannedMinutes) || plannedMinutes < 1 || plannedMinutes > 480) nextErrors.minutes = "Вкажіть ціле число від 1 до 480";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave({ title: title.trim(), project: project.trim(), plannedMinutes, icon: task?.icon ?? "list", emoji: emoji.trim() || "📝" });
  };
  return <Dialog className="task-editor-dialog" title={task ? "Редагувати задачу" : "Нова задача"} description="Один конкретний наступний крок — без зайвих полів." onClose={onClose}>
    <form className="task-editor" onSubmit={submit} onKeyDown={(event) => { if (event.key !== "Escape" || !pickerOpen) return; event.preventDefault(); event.stopPropagation(); setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }}>
      <aside className="task-editor-rail" aria-label="Емоджі задачі" inert={pickerOpen ? true : undefined}>
        <span className="task-editor-index">{task ? "ЗАДАЧА" : "НОВА · 01"}</span>
        <button ref={pickerButtonRef} className={`editorial-emoji-button ${pickerOpen ? "open" : ""}`} type="button" onClick={() => { setPickerMounted(true); setPickerOpen((open) => !open); }} aria-expanded={pickerOpen} aria-controls="task-emoji-catalog" aria-label={`Емоджі ${emoji}. ${pickerOpen ? "Закрити каталог" : "Відкрити каталог"}`}><span aria-hidden="true">{emoji}</span></button>
        <button className="emoji-change-label" type="button" onClick={() => { setPickerMounted(true); setPickerOpen(true); }}><SmilePlus aria-hidden="true"/>Змінити</button>
      </aside>
      <div className="task-editor-fields" inert={pickerOpen ? true : undefined}>
        <label>Назва<input autoFocus data-dialog-initial-focus maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); if (errors.title) setErrors((current) => ({ ...current, title: undefined })); }} placeholder="Що потрібно зробити?" required aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "task-title-error" : undefined}/>{errors.title && <small className="field-error" id="task-title-error" role="alert">{errors.title}</small>}</label>
        <div className="editor-grid"><label>Проєкт<input maxLength={60} value={project} onChange={(event) => setProject(event.target.value)} placeholder="Необов’язково"/></label><label>Час, хв<input type="number" min="1" max="480" step="1" value={plannedMinutes} onChange={(event) => { setPlannedMinutes(Number(event.target.value)); if (errors.minutes) setErrors((current) => ({ ...current, minutes: undefined })); }} aria-invalid={Boolean(errors.minutes)} aria-describedby={errors.minutes ? "task-minutes-error" : undefined}/>{errors.minutes && <small className="field-error" id="task-minutes-error" role="alert">{errors.minutes}</small>}</label></div>
        <div className="dialog-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">{task ? "Зберегти" : "Додати"}</button></div>
      </div>
      {pickerMounted && <aside ref={pickerRef} className={`editorial-emoji-popover ${pickerOpen ? "open" : "preloaded"}`} id="task-emoji-catalog" role="dialog" aria-modal="true" aria-label="Каталог усіх емоджі" aria-hidden={!pickerOpen} inert={!pickerOpen ? true : undefined}><header><span><SmilePlus aria-hidden="true"/>Обрати емоджі</span><button data-emoji-initial-focus type="button" onClick={() => { setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }} aria-label="Закрити каталог"><X aria-hidden="true"/></button></header><Suspense fallback={<div className="emoji-loading" role="status">Завантажую емоджі…</div>}><EmojiCatalog onSelect={(selected) => { setEmoji(selected); setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }}/></Suspense></aside>}
    </form>
  </Dialog>;
}
