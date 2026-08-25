import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task, TaskInput } from "../domain/types";
import { AiPanel } from "../features/ai-panel/AiPanel";
import { FocusDock } from "../features/focus-dock/FocusDock";
import { AppHeader } from "../features/header/AppHeader";
import { TaskDock } from "../features/task-dock/TaskDock";
import { TaskEditor } from "../features/task-editor/TaskEditor";
import { TaskQueue } from "../features/task-queue/TaskQueue";
import { Dialog } from "../shared/Dialog";
import { AppStoreProvider, useAppStore } from "../store/AppStore";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/responsive.css";

function Workspace() {
  const { state, createTask, updateTask, deleteTask } = useAppStore();
  const [queueOpen, setQueueOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [deleteCandidate, setDeleteCandidate] = useState<Task | null>(null);
  const selectedTask = useMemo(() => state.tasks.find((task) => task.id === state.selectedTaskId && task.status === "todo") ?? state.tasks.filter((task) => task.status === "todo").sort((a, b) => a.order - b.order)[0] ?? null, [state.selectedTaskId, state.tasks]);
  const closeTopLayer = useCallback(() => {
    if (deleteCandidate) setDeleteCandidate(null);
    else if (editor.open) setEditor({ open: false, task: null });
    else if (aiOpen) setAiOpen(false);
    else if (queueOpen) setQueueOpen(false);
  }, [aiOpen, deleteCandidate, editor.open, queueOpen]);
  useEffect(() => {
    if (!queueOpen && !aiOpen) return;
    const keydown = (event: KeyboardEvent) => event.key === "Escape" && closeTopLayer();
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [aiOpen, closeTopLayer, queueOpen]);
  const saveTask = (input: TaskInput) => {
    if (editor.task) updateTask(editor.task.id, input); else createTask(input);
    setEditor({ open: false, task: null });
  };

  return <main className="screen">
    <AppHeader onAddTask={() => setEditor({ open: true, task: null })} onOpenAi={() => { setQueueOpen(false); setAiOpen(true); }}/>
    <FocusDock task={selectedTask} onEdit={(task) => setEditor({ open: true, task })} onAdd={() => setEditor({ open: true, task: null })}/>
    <TaskDock onOpenAll={() => { setAiOpen(false); setQueueOpen(true); }}/>

    {(queueOpen || aiOpen) && <button className="panel-backdrop" type="button" onClick={closeTopLayer} aria-label="Закрити панель"/>}
    {queueOpen && <TaskQueue onClose={() => setQueueOpen(false)} onAdd={() => setEditor({ open: true, task: null })} onEdit={(task) => setEditor({ open: true, task })} onDelete={setDeleteCandidate}/>} 
    {aiOpen && <AiPanel onClose={() => setAiOpen(false)}/>} 
    {editor.open && <TaskEditor task={editor.task} onClose={() => setEditor({ open: false, task: null })} onSave={saveTask}/>} 
    {deleteCandidate && <Dialog title="Видалити задачу?" description={`«${deleteCandidate.title}» і весь зафіксований для неї час буде видалено.`} onClose={() => setDeleteCandidate(null)}><div className="dialog-actions"><button type="button" onClick={() => setDeleteCandidate(null)}>Скасувати</button><button className="danger" type="button" onClick={() => { deleteTask(deleteCandidate.id); setDeleteCandidate(null); }}>Видалити</button></div></Dialog>}
  </main>;
}

export default function App() {
  return <AppStoreProvider><Workspace/></AppStoreProvider>;
}
