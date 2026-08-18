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
  const settings = settingsRow ? { ...defaultSettings, ...JSON.parse(settingsRow.value_json) } : { ...defaultSettings };
  return { schemaVersion: 1, projects, tasks, sessions, settings };
}

export async function saveSnapshot(snapshot: AppSnapshot) {
  if (!isDesktop()) {
    localStorage.setItem(BROWSER_KEY, JSON.stringify(snapshot));
    return;
  }

  const database = await getDatabase();
  await database.execute("BEGIN IMMEDIATE");
  try {
    await database.execute("DELETE FROM focus_sessions");
    await database.execute("DELETE FROM tasks");
    await database.execute("DELETE FROM projects");

    for (const project of snapshot.projects) {
      await database.execute(
        "INSERT INTO projects (id, title, description, skill, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [project.id, project.title, project.description, project.skill, project.status, project.sortOrder, project.createdAt, project.updatedAt],
      );
    }
    for (const task of snapshot.tasks) {
      await database.execute(
        "INSERT INTO tasks (id, project_id, title, status, target_duration_ms, sort_order, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [task.id, task.projectId, task.title, task.status, task.targetMinutes * 60_000, task.sortOrder, task.createdAt, task.updatedAt, task.completedAt],
      );
    }
    for (const session of snapshot.sessions) {
      await database.execute(
        "INSERT INTO focus_sessions (id, task_id, started_at, ended_at, finalized_duration_ms, target_duration_ms, target_notification_sent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [session.id, session.taskId, session.startedAt, session.endedAt, session.durationMs, session.targetMinutes * 60_000, session.targetNotified ? 1 : 0, session.startedAt, session.endedAt ?? session.startedAt],
      );
    }
    await database.execute(
      "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('preferences', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
      [JSON.stringify(snapshot.settings), new Date().toISOString()],
    );
    await database.execute("COMMIT");
  } catch (error) {
    await database.execute("ROLLBACK");
    throw error;
  }
}
