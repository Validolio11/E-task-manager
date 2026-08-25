import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { appReducer } from "../domain/state";
import type { AiMessage, AppState, Task, TaskInput } from "../domain/types";
import { loadStateResult, recoverState, saveState, STORAGE_KEY } from "../persistence/storage";
import "./store.css";

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
  const [loaded] = useState(loadStateResult);
  const [state, dispatch] = useReducer(appReducer, loaded.state);
  const [loadWarning, setLoadWarning] = useState(loaded.warning);
  const [saveError, setSaveError] = useState<string | null>(null);
  const externalStateToSkip = useRef<AppState | null>(null);

  useEffect(() => {
    if (externalStateToSkip.current === state) {
      externalStateToSkip.current = null;
      return;
    }
    const result = saveState(state);
    setSaveError(result.ok ? null : result.error);
  }, [state]);
  useEffect(() => {
    const synchronizeTabs = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === null) {
        const emptyState = recoverState(null).state;
        externalStateToSkip.current = emptyState;
        dispatch({ type: "state/replace", state: emptyState });
        return;
      }
      try {
        const recovered = recoverState(JSON.parse(event.newValue));
        externalStateToSkip.current = recovered.state;
        dispatch({ type: "state/replace", state: recovered.state });
        if (recovered.recovered) setLoadWarning("Зміни з іншої вкладки містили пошкоджені дані. Відновлено лише безпечну частину.");
      } catch {
        setLoadWarning("Зміни з іншої вкладки пошкоджені й не були застосовані.");
      }
    };
    window.addEventListener("storage", synchronizeTabs);
    return () => window.removeEventListener("storage", synchronizeTabs);
  }, []);

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
  const persistenceMessage = saveError ?? loadWarning;
  const retrySave = () => {
    const result = saveState(state);
    setSaveError(result.ok ? null : result.error);
  };

  return <StoreContext.Provider value={value}>
    {children}
    {persistenceMessage && <div className="persistence-alert" role="alert" aria-live="assertive">
      <span>{persistenceMessage}</span>
      {saveError && <button type="button" onClick={retrySave}>Повторити</button>}
      <button type="button" aria-label="Закрити повідомлення" onClick={() => { setSaveError(null); setLoadWarning(null); }}>×</button>
    </div>}
  </StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useAppStore must be used inside AppStoreProvider");
  return value;
}
