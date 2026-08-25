import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
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
  return <Dialog title={task ? "Редагувати задачу" : "Нова задача"} description="Один конкретний наступний крок — без зайвих полів." onClose={onClose}>
    <form className="task-editor" onSubmit={submit}>
      <label>Назва<input autoFocus maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Що потрібно зробити?" required/></label>
      <div className="editor-grid"><label>Проєкт<input maxLength={60} value={project} onChange={(event) => setProject(event.target.value)} placeholder="Необов’язково"/></label><label>Час, хв<input type="number" min="1" max="480" step="1" value={plannedMinutes} onChange={(event) => setPlannedMinutes(Number(event.target.value))}/></label></div>
      <fieldset><legend>Емоджі</legend><button ref={pickerButtonRef} className={`emoji-select-toggle ${pickerOpen ? "open" : ""}`} type="button" onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} aria-controls="task-emoji-catalog" aria-label={`Емоджі ${emoji}. ${pickerOpen ? "Закрити каталог" : "Відкрити каталог"}`}><span className="selected-emoji" aria-hidden="true">{emoji}</span><span>{pickerOpen ? "Сховати емоджі" : "Обрати емоджі"}</span><ChevronDown aria-hidden="true"/></button>{pickerOpen && <div id="task-emoji-catalog"><Suspense fallback={<div className="emoji-loading">Завантажую емоджі…</div>}><EmojiCatalog onSelect={(selected) => { setEmoji(selected); setPickerOpen(false); requestAnimationFrame(() => pickerButtonRef.current?.focus()); }}/></Suspense></div>}</fieldset>
      <div className="dialog-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">{task ? "Зберегти" : "Додати"}</button></div>
    </form>
  </Dialog>;
}
