import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import {
  AppSettings,
  AppSnapshot,
  emptySnapshot,
  FocusSession,
  Project,
  sanitizeSnapshot,
  Task,
} from "./domain";
import { loadSnapshot, saveSnapshot } from "./persistence";

type ProjectInput = Pick<Project, "title" | "description" | "skill">;
type TaskInput = Pick<Task, "title" | "projectId" | "targetMinutes">;

function uuid() {
  return crypto.randomUUID();
}

function playTargetSound() {
  try {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.34);
  } catch {
    // Audio feedback is optional and must never interrupt focus tracking.
  }
}

async function showTargetNotification(taskTitle?: string) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) {
      sendNotification({
        title: "Ціль фокусу досягнута",
        body: taskTitle ? `${taskTitle}. Можна продовжувати у своєму темпі.` : "Можна продовжувати у своєму темпі.",
      });
    }
  } catch {
    // The in-app notice remains available if native notifications are disabled.
  }
}

export function useFocusStore() {
  const [data, setData] = useState<AppSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    loadSnapshot()
      .then(setData)
      .catch((error) => setNotice(`Не вдалося відкрити локальні дані: ${String(error)}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const commit = useCallback((update: (current: AppSnapshot) => AppSnapshot) => {
    setData((current) => {
      const next = update(current);
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => saveSnapshot(next))
        .catch((error) => setNotice(`Помилка збереження: ${String(error)}`));
      return next;
    });
  }, []);

  const activeSession = useMemo(() => data.sessions.find((session) => !session.endedAt) ?? null, [data.sessions]);
  const activeTask = useMemo(() => data.tasks.find((task) => task.id === activeSession?.taskId) ?? null, [activeSession, data.tasks]);

  useEffect(() => {
    if (!activeSession || activeSession.targetNotified) return;
    const elapsed = now - Date.parse(activeSession.startedAt);
    if (elapsed < activeSession.targetMinutes * 60_000) return;

    commit((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === activeSession.id ? { ...session, targetNotified: true } : session),
    }));
    const task = data.tasks.find((item) => item.id === activeSession.taskId);
    setNotice(`Ціль досягнута${task ? `: ${task.title}` : ""}. Можна продовжувати у своєму темпі.`);
    void showTargetNotification(task?.title);
    if (data.settings.soundEnabled) playTargetSound();
  }, [activeSession, commit, data.settings.soundEnabled, data.tasks, now]);

  const finalizeActive = (snapshot: AppSnapshot, endedAt: string) => {
    const active = snapshot.sessions.find((session) => !session.endedAt);
    if (!active) return snapshot.sessions;
    const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(active.startedAt));
    return snapshot.sessions.map((session) => session.id === active.id ? { ...session, endedAt, durationMs } : session);
  };

  const createProject = useCallback((input: ProjectInput) => {
    const timestamp = new Date().toISOString();
    const project: Project = {
      id: uuid(), title: input.title.trim(), description: input.description.trim(), skill: input.skill.trim() || "Інше",
      status: "active", sortOrder: data.projects.length, createdAt: timestamp, updatedAt: timestamp,
    };
    commit((current) => ({ ...current, projects: [...current.projects, project] }));
    setNotice("Проєкт створено.");
    return project.id;
  }, [commit, data.projects.length]);

  const updateProject = useCallback((id: string, input: ProjectInput) => {
    const updatedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      projects: current.projects.map((project) => project.id === id ? { ...project, ...input, title: input.title.trim(), description: input.description.trim(), skill: input.skill.trim() || "Інше", updatedAt } : project),
    }));
    setNotice("Проєкт оновлено.");
  }, [commit]);

  const createTask = useCallback((input: TaskInput) => {
    const timestamp = new Date().toISOString();
    const task: Task = {
      id: uuid(), title: input.title.trim(), projectId: input.projectId, targetMinutes: input.targetMinutes,
      status: "todo", sortOrder: data.tasks.filter((item) => item.projectId === input.projectId).length,
      createdAt: timestamp, updatedAt: timestamp, completedAt: null,
    };
    commit((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setNotice("Задачу додано.");
    return task.id;
  }, [commit, data.tasks]);

  const updateTask = useCallback((id: string, input: TaskInput) => {
    const updatedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, ...input, title: input.title.trim(), updatedAt } : task),
    }));
    setNotice("Задачу оновлено.");
  }, [commit]);

  const startTask = useCallback((taskId: string, targetMinutes?: number) => {
    const startedAt = new Date().toISOString();
    commit((current) => {
      const selected = current.tasks.find((task) => task.id === taskId);
      if (!selected) return current;
      const sessions = finalizeActive(current, startedAt);
      const session: FocusSession = {
        id: uuid(), taskId, startedAt, endedAt: null, durationMs: null,
        targetMinutes: targetMinutes ?? selected.targetMinutes, targetNotified: false,
      };
      return {
        ...current,
        tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status: "in_progress", updatedAt: startedAt, completedAt: null } : task),
        sessions: [...sessions, session],
      };
    });
    setNow(Date.now());
  }, [commit]);

  const stopActive = useCallback(() => {
    const endedAt = new Date().toISOString();
    commit((current) => ({ ...current, sessions: finalizeActive(current, endedAt) }));
    setNotice("Сесію зупинено. Весь час збережено.");
  }, [commit]);

  const completeTask = useCallback((taskId: string) => {
    const completedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      sessions: current.sessions.some((session) => !session.endedAt && session.taskId === taskId) ? finalizeActive(current, completedAt) : current.sessions,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status: "completed", completedAt, updatedAt: completedAt } : task),
    }));
    setNotice("Задачу завершено.");
  }, [commit]);

  const reopenTask = useCallback((taskId: string) => {
    const updatedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status: "todo", completedAt: null, updatedAt } : task),
    }));
  }, [commit]);

  const deleteTask = useCallback((taskId: string) => {
    commit((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
      sessions: current.sessions.filter((session) => session.taskId !== taskId),
    }));
    setNotice("Задачу та її статистику видалено.");
  }, [commit]);

  const deleteProject = useCallback((projectId: string) => {
    commit((current) => {
      const taskIds = new Set(current.tasks.filter((task) => task.projectId === projectId).map((task) => task.id));
      return {
        ...current,
        projects: current.projects.filter((project) => project.id !== projectId),
        tasks: current.tasks.filter((task) => task.projectId !== projectId),
        sessions: current.sessions.filter((session) => !taskIds.has(session.taskId)),
      };
    });
    setNotice("Проєкт, його задачі та статистику видалено.");
  }, [commit]);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    commit((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
  }, [commit]);

  const importBackup = useCallback((value: unknown) => {
    const snapshot = sanitizeSnapshot(value);
    setData(snapshot);
    saveQueue.current = saveQueue.current.then(() => saveSnapshot(snapshot));
    setNotice("Резервну копію імпортовано.");
  }, []);

  const resetAll = useCallback(() => {
    const next = emptySnapshot();
    setData(next);
    saveQueue.current = saveQueue.current.then(() => saveSnapshot(next));
    setNotice("Усі локальні дані очищено.");
  }, []);

  return {
    data, loading, now, notice, activeSession, activeTask,
    createProject, updateProject, createTask, updateTask, startTask, stopActive,
    completeTask, reopenTask, deleteTask, deleteProject, updateSettings, importBackup, resetAll,
  };
}
