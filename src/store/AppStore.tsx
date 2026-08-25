import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { appReducer } from "../domain/state";
import type { AiMessage, AppState, Task, TaskInput } from "../domain/types";
import { loadState, saveState } from "../persistence/storage";

type AppStore = {
  state: AppState;
  selectTask: (taskId: string) => void;
  createTask: (input: TaskInput) => void;
  updateTask: (taskId: string, input: TaskInput) => void;
  deleteTask: (taskId: string) => void;
  startFocus: (taskId: string) => void;
  pauseFocus: () => void;
  completeTask: (taskId: string) => void;
  reopenTask: (taskId: string) => void;
  addAiMessage: (message: Omit<AiMessage, "id" | "createdAt">) => void;
};

const StoreContext = createContext<AppStore | null>(null);
const id = () => crypto.randomUUID();

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadState);

  useEffect(() => { saveState(state); }, [state]);

  const selectTask = useCallback((taskId: string) => dispatch({ type: "task/select", taskId }), []);
  const createTask = useCallback((input: TaskInput) => {
    const now = Date.now();
    const task: Task = { ...input, id: id(), status: "todo", order: now, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), completedAt: null };
    dispatch({ type: "task/create", task });
  }, []);
  const updateTask = useCallback((taskId: string, input: TaskInput) => dispatch({ type: "task/update", taskId, input, now: Date.now() }), []);
  const deleteTask = useCallback((taskId: string) => dispatch({ type: "task/delete", taskId }), []);
  const startFocus = useCallback((taskId: string) => dispatch({ type: "focus/start", taskId, now: Date.now(), entryId: id() }), []);
  const pauseFocus = useCallback(() => dispatch({ type: "focus/pause", now: Date.now(), entryId: id() }), []);
  const completeTask = useCallback((taskId: string) => dispatch({ type: "focus/complete", taskId, now: Date.now(), entryId: id() }), []);
  const reopenTask = useCallback((taskId: string) => dispatch({ type: "task/reopen", taskId, now: Date.now() }), []);
  const addAiMessage = useCallback((message: Omit<AiMessage, "id" | "createdAt">) => dispatch({ type: "ai/add", message: { ...message, id: id(), createdAt: new Date().toISOString() } }), []);

  const value = useMemo<AppStore>(() => ({ state, selectTask, createTask, updateTask, deleteTask, startFocus, pauseFocus, completeTask, reopenTask, addAiMessage }), [state, selectTask, createTask, updateTask, deleteTask, startFocus, pauseFocus, completeTask, reopenTask, addAiMessage]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useAppStore must be used inside AppStoreProvider");
  return value;
}
