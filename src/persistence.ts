import Database from "@tauri-apps/plugin-sql";
import { AppSnapshot, defaultSettings, emptySnapshot, FocusSession, Project, sanitizeSnapshot, Task } from "./domain";

const DATABASE_URL = "sqlite:etask.db";
const BROWSER_KEY = "etask.snapshot.v1";
const isDesktop = () => "__TAURI_INTERNALS__" in window;

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  skill: string | null;
  status: Project["status"];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: Task["status"];
  target_duration_ms: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type SessionRow = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  finalized_duration_ms: number | null;
  target_duration_ms: number;
  target_notification_sent: number;
};

let databasePromise: Promise<Database> | null = null;
let desktopSaveQueue: Promise<void> = Promise.resolve();
let persistedSnapshot: AppSnapshot | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  if (!isDesktop()) {
    const saved = localStorage.getItem(BROWSER_KEY);
    return saved ? sanitizeSnapshot(JSON.parse(saved)) : emptySnapshot();
  }

  const database = await getDatabase();
  const [projectRows, taskRows, sessionRows, settingsRows] = await Promise.all([
    database.select<ProjectRow[]>("SELECT * FROM projects ORDER BY sort_order, created_at"),
    database.select<TaskRow[]>("SELECT * FROM tasks ORDER BY sort_order, created_at"),
    database.select<SessionRow[]>("SELECT * FROM focus_sessions ORDER BY started_at"),
    database.select<{ key: string; value_json: string }[]>("SELECT key, value_json FROM app_settings"),
  ]);

  const projects: Project[] = projectRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    skill: row.skill ?? "Інше",
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const tasks: Task[] = taskRows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    targetMinutes: Math.max(1, Math.round(row.target_duration_ms / 60_000)),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }));

  const sessions: FocusSession[] = sessionRows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.finalized_duration_ms,
    targetMinutes: Math.max(1, Math.round(row.target_duration_ms / 60_000)),
    targetNotified: Boolean(row.target_notification_sent),
  }));

  const settingsRow = settingsRows.find((row) => row.key === "preferences");
  let settings = { ...defaultSettings };
  if (settingsRow) {
    try {
      const savedSettings = JSON.parse(settingsRow.value_json);
      if (savedSettings && typeof savedSettings === "object") settings = { ...settings, ...savedSettings };
    } catch {
      // A damaged preferences row must not prevent projects, tasks and sessions from opening.
    }
  }
  const snapshot: AppSnapshot = { schemaVersion: 1, projects, tasks, sessions, settings };
  persistedSnapshot = snapshot;
  return snapshot;
}

export function saveSnapshot(snapshot: AppSnapshot) {
  if (!isDesktop()) {
    localStorage.setItem(BROWSER_KEY, JSON.stringify(snapshot));
    return Promise.resolve();
  }

  desktopSaveQueue = desktopSaveQueue
    .catch(() => undefined)
    .then(() => writeDesktopSnapshot(snapshot));
  return desktopSaveQueue;
}

type IdRow = { id: string };

async function deleteRemoved(database: Database, table: "focus_sessions" | "tasks" | "projects", retainedIds: Set<string>) {
  const rows = await database.select<IdRow[]>(`SELECT id FROM ${table}`);
  for (const row of rows) {
    if (!retainedIds.has(row.id)) {
      await executeWithRetry(database, `DELETE FROM ${table} WHERE id = ?`, [row.id]);
    }
  }
}

async function executeWithRetry(database: Database, query: string, values: unknown[] = []) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await database.execute(query, values);
    } catch (error) {
      const locked = /database is locked|code:\s*5/i.test(String(error));
      if (!locked || attempt >= 4) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 80 * 2 ** attempt));
    }
  }
}

async function writeDesktopSnapshot(snapshot: AppSnapshot) {
  const database = await getDatabase();
  const previous = persistedSnapshot;
  const previousProjects = new Map(previous?.projects.map((project) => [project.id, project]));
  const previousTasks = new Map(previous?.tasks.map((task) => [task.id, task]));
  const previousSessions = new Map(previous?.sessions.map((session) => [session.id, session]));

  // The Tauri SQL plugin checks a pooled connection out for each command.
  // Manual BEGIN/COMMIT calls can therefore land on different connections
  // and leave SQLite permanently locked. Each command below is atomic, writes
  // are serialized, and upserts happen before stale rows are removed.
  for (const project of snapshot.projects) {
    if (sameProject(previousProjects.get(project.id), project)) continue;
    await executeWithRetry(
      database,
      `INSERT INTO projects (id, title, description, skill, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         skill = excluded.skill,
         status = excluded.status,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [project.id, project.title, project.description, project.skill, project.status, project.sortOrder, project.createdAt, project.updatedAt],
    );
  }
  for (const task of snapshot.tasks) {
    if (sameTask(previousTasks.get(task.id), task)) continue;
    await executeWithRetry(
      database,
      `INSERT INTO tasks (id, project_id, title, status, target_duration_ms, sort_order, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         title = excluded.title,
         status = excluded.status,
         target_duration_ms = excluded.target_duration_ms,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at,
         completed_at = excluded.completed_at`,
      [task.id, task.projectId, task.title, task.status, task.targetMinutes * 60_000, task.sortOrder, task.createdAt, task.updatedAt, task.completedAt],
    );
  }
  for (const session of snapshot.sessions) {
    if (sameSession(previousSessions.get(session.id), session)) continue;
    await executeWithRetry(
      database,
      `INSERT INTO focus_sessions (id, task_id, started_at, ended_at, finalized_duration_ms, target_duration_ms, target_notification_sent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         task_id = excluded.task_id,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         finalized_duration_ms = excluded.finalized_duration_ms,
         target_duration_ms = excluded.target_duration_ms,
         target_notification_sent = excluded.target_notification_sent,
         updated_at = excluded.updated_at`,
      [session.id, session.taskId, session.startedAt, session.endedAt, session.durationMs, session.targetMinutes * 60_000, session.targetNotified ? 1 : 0, session.startedAt, session.endedAt ?? session.startedAt],
    );
  }
  if (!previous || JSON.stringify(previous.settings) !== JSON.stringify(snapshot.settings)) {
    await executeWithRetry(
      database,
      "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('preferences', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
      [JSON.stringify(snapshot.settings), new Date().toISOString()],
    );
  }

  const sessionIds = new Set(snapshot.sessions.map((session) => session.id));
  const taskIds = new Set(snapshot.tasks.map((task) => task.id));
  const projectIds = new Set(snapshot.projects.map((project) => project.id));
  if (previous) {
    for (const session of previous.sessions) {
      if (!sessionIds.has(session.id)) await executeWithRetry(database, "DELETE FROM focus_sessions WHERE id = ?", [session.id]);
    }
    for (const task of previous.tasks) {
      if (!taskIds.has(task.id)) await executeWithRetry(database, "DELETE FROM tasks WHERE id = ?", [task.id]);
    }
    for (const project of previous.projects) {
      if (!projectIds.has(project.id)) await executeWithRetry(database, "DELETE FROM projects WHERE id = ?", [project.id]);
    }
  } else {
    await deleteRemoved(database, "focus_sessions", sessionIds);
    await deleteRemoved(database, "tasks", taskIds);
    await deleteRemoved(database, "projects", projectIds);
  }
  persistedSnapshot = snapshot;
}

function sameProject(previous: Project | undefined, next: Project) {
  return previous?.title === next.title
    && previous.description === next.description
    && previous.skill === next.skill
    && previous.status === next.status
    && previous.sortOrder === next.sortOrder
    && previous.createdAt === next.createdAt
    && previous.updatedAt === next.updatedAt;
}

function sameTask(previous: Task | undefined, next: Task) {
  return previous?.projectId === next.projectId
    && previous.title === next.title
    && previous.status === next.status
    && previous.targetMinutes === next.targetMinutes
    && previous.sortOrder === next.sortOrder
    && previous.createdAt === next.createdAt
    && previous.updatedAt === next.updatedAt
    && previous.completedAt === next.completedAt;
}

function sameSession(previous: FocusSession | undefined, next: FocusSession) {
  return previous?.taskId === next.taskId
    && previous.startedAt === next.startedAt
    && previous.endedAt === next.endedAt
    && previous.durationMs === next.durationMs
    && previous.targetMinutes === next.targetMinutes
    && previous.targetNotified === next.targetNotified;
}
