import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import {
  AppSettings,
  AppSnapshot,
  emptySnapshot,
  FocusSession,
  INBOX_PROJECT_ID,
  isTaskTargetMinutes,
  normalizeTaskIconKey,
  Project,
  removeTaskWithSessions,
  sanitizeSnapshot,
  setTaskTargetMinutes,
  Task,
  TaskIconKey,
  trackedTimeByTask,
} from "./domain";
import { loadSnapshot, saveSnapshot } from "./persistence";

type ProjectInput = Pick<Project, "title" | "description" | "skill">;
type TaskInput = Pick<Task, "title" | "projectId" | "targetMinutes"> & { iconKey?: TaskIconKey };

function uuid() {
  return crypto.randomUUID();
}

function inboxProject(timestamp: string, sortOrder: number): Project {
  return {
    id: INBOX_PROJECT_ID,
    title: "Без проєкту",
    description: "Задачі, які ще не належать до окремого проєкту.",
    skill: "Інше",
    status: "active",
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function finalizeActive(snapshot: AppSnapshot, endedAt: string) {
  const active = snapshot.sessions.find((session) => !session.endedAt);
  if (!active) return snapshot.sessions;
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(active.startedAt));
  return snapshot.sessions.map((session) => session.id === active.id ? { ...session, endedAt, durationMs } : session);
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
    oscillator.onended = () => void context.close();
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
  const [notice, setNotice] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const loadedOnce = useRef(false);
  const shouldPersist = useRef(false);
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
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (loading || !shouldPersist.current) return;
    shouldPersist.current = false;
    const snapshot = data;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveSnapshot(snapshot))
      .catch((error) => setNotice(`Помилка збереження: ${String(error)}`));
  }, [data, loading]);

  const commit = useCallback((update: (current: AppSnapshot) => AppSnapshot) => {
    shouldPersist.current = true;
    setData(update);
  }, []);

  const activeSession = useMemo(() => data.sessions.find((session) => !session.endedAt) ?? null, [data.sessions]);
  const activeTask = useMemo(() => data.tasks.find((task) => task.id === activeSession?.taskId) ?? null, [activeSession, data.tasks]);
  const finalizedMsByTask = useMemo(
    () => trackedTimeByTask(data.sessions.filter((session) => session.endedAt), 0),
    [data.sessions],
  );
  useEffect(() => {
    if (!activeSession || activeSession.targetNotified) return;
    const targetAt = Date.parse(activeSession.startedAt) + activeSession.targetMinutes * 60_000;
    let fired = false;
    const notifyReached = () => {
      const currentSession = dataRef.current.sessions.find((session) => session.id === activeSession.id);
      if (fired || Date.now() < targetAt || !currentSession || currentSession.endedAt || currentSession.targetNotified) return;
      fired = true;
      commit((current) => ({
        ...current,
        sessions: current.sessions.map((session) => session.id === activeSession.id ? { ...session, targetNotified: true } : session),
      }));
      const task = dataRef.current.tasks.find((item) => item.id === activeSession.taskId);
      setNotice(`Ціль досягнута${task ? `: ${task.title}` : ""}. Можна продовжувати у своєму темпі.`);
      void showTargetNotification(task?.title);
      if (dataRef.current.settings.soundEnabled) playTargetSound();
    };
    const remaining = targetAt - Date.now();
    const timeout = remaining <= 0
      ? window.setTimeout(notifyReached, 0)
      : window.setTimeout(notifyReached, Math.min(remaining, 2_147_483_647));
    const syncWhenVisible = () => document.visibilityState === "visible" && notifyReached();
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [activeSession, commit]);

  const createProject = useCallback((input: ProjectInput) => {
    const timestamp = new Date().toISOString();
    const project: Project = {
      id: uuid(), title: input.title.trim(), description: input.description.trim(), skill: input.skill.trim() || "Інше",
      status: "active", sortOrder: 0, createdAt: timestamp, updatedAt: timestamp,
    };
    commit((current) => ({ ...current, projects: [...current.projects, { ...project, sortOrder: current.projects.length }] }));
    setNotice("Проєкт створено.");
    return project.id;
  }, [commit]);

  const updateProject = useCallback((id: string, input: ProjectInput) => {
    const updatedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      projects: current.projects.map((project) => project.id === id ? { ...project, ...input, title: input.title.trim(), description: input.description.trim(), skill: input.skill.trim() || "Інше", updatedAt } : project),
    }));
    setNotice("Проєкт оновлено.");
  }, [commit]);

  const createTask = useCallback((input: TaskInput) => {
    if (!isTaskTargetMinutes(input.targetMinutes)) throw new Error("Ціль фокусу має бути цілим числом від 1 до 240 хвилин.");
    const timestamp = new Date().toISOString();
    const projectId = input.projectId || INBOX_PROJECT_ID;
    const task: Task = {
      id: uuid(), title: input.title.trim(), projectId, targetMinutes: input.targetMinutes,
      iconKey: normalizeTaskIconKey(input.iconKey),
      status: "todo", sortOrder: 0,
      createdAt: timestamp, updatedAt: timestamp, completedAt: null,
    };
    commit((current) => {
      const hasInbox = current.projects.some((project) => project.id === INBOX_PROJECT_ID);
      return {
        ...current,
        projects: projectId === INBOX_PROJECT_ID && !hasInbox ? [...current.projects, inboxProject(timestamp, current.projects.length)] : current.projects,
        tasks: [...current.tasks, { ...task, sortOrder: current.tasks.filter((item) => item.projectId === projectId).length }],
      };
    });
    setNotice("Задачу додано.");
    return task.id;
  }, [commit]);

  const updateTask = useCallback((id: string, input: TaskInput) => {
    if (!isTaskTargetMinutes(input.targetMinutes)) throw new Error("Ціль фокусу має бути цілим числом від 1 до 240 хвилин.");
    const updatedAt = new Date().toISOString();
    const projectId = input.projectId || INBOX_PROJECT_ID;
    commit((current) => {
      const needsInbox = projectId === INBOX_PROJECT_ID && !current.projects.some((project) => project.id === INBOX_PROJECT_ID);
      return {
        ...current,
        projects: needsInbox ? [...current.projects, inboxProject(updatedAt, current.projects.length)] : current.projects,
        tasks: current.tasks.map((task) => task.id === id ? {
          ...task,
          title: input.title.trim(),
          projectId,
          targetMinutes: input.targetMinutes,
          iconKey: input.iconKey === undefined ? task.iconKey : normalizeTaskIconKey(input.iconKey),
          updatedAt,
        } : task),
      };
    });
    setNotice("Задачу оновлено.");
  }, [commit]);

  const updateTaskTarget = useCallback((id: string, targetMinutes: number) => {
    if (!isTaskTargetMinutes(targetMinutes) || !dataRef.current.tasks.some((task) => task.id === id)) {
      setNotice("Вкажи цілу ціль від 1 до 240 хвилин.");
      return false;
    }
    const updatedAt = new Date().toISOString();
    commit((current) => setTaskTargetMinutes(current, id, targetMinutes, updatedAt));
    setNotice(`Ціль фокусу змінено на ${targetMinutes} хв.`);
    return true;
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
    commit((current) => removeTaskWithSessions(current, taskId));
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
    shouldPersist.current = true;
    setData(snapshot);
    setNotice("Резервну копію імпортовано.");
  }, []);

  const resetAll = useCallback(() => {
    const next = emptySnapshot();
    shouldPersist.current = true;
    setData(next);
    setNotice("Усі локальні дані очищено.");
  }, []);

  return {
    data, loading, notice, activeSession, activeTask, finalizedMsByTask,
    createProject, updateProject, createTask, updateTask, updateTaskTarget, startTask, stopActive,
    completeTask, reopenTask, deleteTask, deleteProject, updateSettings, importBackup, resetAll,
  };
}
