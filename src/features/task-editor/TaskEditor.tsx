import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { SmilePlus, X } from "lucide-react";
import type { Task, TaskInput } from "../../domain/types";
import { Dialog } from "../../shared/Dialog";
import { resolveTaskEmoji } from "../../shared/TaskIcon";
import "./task-editor.css";

const EmojiCatalog = lazy(() => import("./EmojiCatalog"));

export function TaskEditor({ task, onClose, onSave }: { task: Task | null; onClose: () => void; onSave: (input: TaskInput) => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [project, setProject] = useState(task?.project ?? "");
  const [plannedMinutes, setPlannedMinutes] = useState(task?.plannedMinutes ?? 30);
  const [emoji, setEmoji] = useState(task ? resolveTaskEmoji(task.icon, task.emoji) : "📝");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTitle(task?.title ?? ""); setProject(task?.project ?? ""); setPlannedMinutes(task?.plannedMinutes ?? 30); setEmoji(task ? resolveTaskEmoji(task.icon, task.emoji) : "📝"); setPickerOpen(false); }, [task]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !Number.isInteger(plannedMinutes) || plannedMinutes < 1 || plannedMinutes > 480) return;
    onSave({ title: title.trim(), project: project.trim(), plannedMinutes, icon: task?.icon ?? "list", emoji: emoji.trim() || "📝" });
  };
  return <Dialog className="task-editor-dialog" title={task ? "Редагувати задачу" : "Нова задача"} description="Один конкретний наступний крок — без зайвих полів." onClose={onClose}>
    <form className="task-editor" onSubmit={submit} onKeyDown={(event) => { if (event.key !== "Escape" || !pickerOpen) return; event.preventDefault(); event.stopPropagation(); setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }}>
      <aside className="task-editor-rail" aria-label="Емоджі задачі">
        <span className="task-editor-index">{task ? "ЗАДАЧА" : "НОВА · 01"}</span>
        <button ref={pickerButtonRef} className={`editorial-emoji-button ${pickerOpen ? "open" : ""}`} type="button" onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} aria-controls="task-emoji-catalog" aria-label={`Емоджі ${emoji}. ${pickerOpen ? "Закрити каталог" : "Відкрити каталог"}`}><span aria-hidden="true">{emoji}</span></button>
        <button className="emoji-change-label" type="button" onClick={() => setPickerOpen(true)}><SmilePlus aria-hidden="true"/>Змінити</button>
      </aside>
      <div className="task-editor-fields">
        <label>Назва<input autoFocus maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Що потрібно зробити?" required/></label>
        <div className="editor-grid"><label>Проєкт<input maxLength={60} value={project} onChange={(event) => setProject(event.target.value)} placeholder="Необов’язково"/></label><label>Час, хв<input type="number" min="1" max="480" step="1" value={plannedMinutes} onChange={(event) => setPlannedMinutes(Number(event.target.value))}/></label></div>
        <div className="dialog-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">{task ? "Зберегти" : "Додати"}</button></div>
      </div>
      {pickerOpen && <aside className="editorial-emoji-popover" id="task-emoji-catalog" aria-label="Каталог усіх емоджі"><header><span><SmilePlus aria-hidden="true"/>Обрати емоджі</span><button type="button" onClick={() => { setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }} aria-label="Закрити каталог"><X aria-hidden="true"/></button></header><Suspense fallback={<div className="emoji-loading">Завантажую емоджі…</div>}><EmojiCatalog onSelect={(selected) => { setEmoji(selected); setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }}/></Suspense></aside>}
    </form>
  </Dialog>;
}
