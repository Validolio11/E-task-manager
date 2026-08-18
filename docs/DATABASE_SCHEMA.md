# E-task Database Schema

This document defines the initial SQLite data model for E-task V1. It is designed around the confirmed product model: `Project -> Task`, one active timer at a time, raw focus-session history as the source for analytics, local-first persistence, and future reuse by MCP.

## 1. Principles

- SQLite is the primary local source of truth.
- Raw sessions are persisted so analytics can be recomputed.
- Do not persist summary-card values as the only source of truth.
- Use migrations for every schema change after the initial migration.
- Prefer UTC timestamps in storage and convert to local time in application logic/UI.
- Use integer milliseconds or seconds consistently for durations. V1 recommendation: integer milliseconds for precise elapsed-time math.
- Foreign keys must be enabled.

## 2. Naming conventions

- Tables: plural `snake_case`.
- Primary keys: text UUIDs unless a later implementation decision standardizes integer IDs.
- Timestamps: ISO-8601 UTC text or SQLite-compatible UTC datetime text.
- Booleans: integer `0/1`.
- Durations: integer milliseconds.

## 3. Initial tables

### 3.1 `projects`

Purpose: top-level work containers.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
```

Notes:

- Project progress is derived from related tasks.
- Total tracked time is derived from sessions, not stored as canonical truth.
- `archived` is available for project lifecycle, even though task V1 states remain intentionally minimal.

### 3.2 `tasks`

Purpose: individual actionable work items inside a project.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'completed')),
  target_duration_ms INTEGER NOT NULL DEFAULT 300000,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

Confirmed V1 task-creation fields:

- title
- project
- skill(s)
- target duration

Priority and deadline are intentionally absent from the default V1 schema unless a later confirmed decision adds them.

### 3.3 `focus_sessions`

Purpose: canonical tracked-work records.

```sql
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  finalized_duration_ms INTEGER,
  target_duration_ms INTEGER NOT NULL,
  target_reached_at TEXT,
  target_notification_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

Rules:

- `ended_at IS NULL` means the session is active.
- `finalized_duration_ms` is written when a session is stopped/completed.
- Active elapsed time is calculated as `now - started_at`.
- Do not update this row every second.
- `target_notification_sent` prevents duplicate target notifications.

### 3.4 One-active-session invariant

SQLite should enforce that only one session may be active.

Recommended partial unique index:

```sql
CREATE UNIQUE INDEX idx_focus_sessions_single_active
ON focus_sessions ((1))
WHERE ended_at IS NULL;
```

If the SQLite/Tauri runtime has any compatibility concern with this expression index, enforce the invariant transactionally in the application service and add a compatible alternative migration. Do not weaken the product invariant.

### 3.5 `skills`

Purpose: named practice categories such as After Effects, Figma or Blender.

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  icon_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Default skills may be inserted as seed data, but users should not be forced to use only predefined skills unless the Product Spec later says so.

### 3.6 `project_skills`

Purpose: many-to-many project/skill relationship.

```sql
CREATE TABLE project_skills (
  project_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  PRIMARY KEY (project_id, skill_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

### 3.7 `task_skills`

Purpose: optional many-to-many task/skill relationship.

```sql
CREATE TABLE task_skills (
  task_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  PRIMARY KEY (task_id, skill_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

Why both project and task links exist:

- A project may contain several skills.
- A specific task may use only a subset of those skills.
- Skill analytics should eventually be based on the most specific available association.

V1 calculation rule recommendation:

1. If a task has explicit `task_skills`, attribute the session to those skills.
2. Otherwise inherit the project's skills.
3. If multiple skills apply to one session, do not blindly duplicate the full session duration into every skill unless the product explicitly chooses that behavior. Until clarified, analytics code should keep this attribution policy isolated and configurable.

### 3.8 `app_settings`

Purpose: durable local settings.

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Expected setting keys include:

- `theme`
- `language`
- `accent_palette`
- `focus_presets_ms`
- `notification_sound_enabled`
- `notification_sound_key`
- `backup_mode`
- `backup_location`
- `window_compactness`
- `startup_behavior`

Use typed application-level accessors rather than scattering raw keys throughout UI components.

### 3.9 `dashboard_widgets`

Purpose: user customization of Home-card visibility/order.

```sql
CREATE TABLE dashboard_widgets (
  widget_key TEXT PRIMARY KEY NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  size_key TEXT,
  updated_at TEXT NOT NULL
);
```

This supports the confirmed direction that dashboard cards can eventually be rearranged and hidden.

### 3.10 `schema_migrations`

If the chosen Tauri SQL migration mechanism already manages migration metadata, do not duplicate it. Otherwise use:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

## 4. Recommended indexes

```sql
CREATE INDEX idx_tasks_project_sort
ON tasks(project_id, sort_order);

CREATE INDEX idx_tasks_status
ON tasks(status);

CREATE INDEX idx_focus_sessions_task_started
ON focus_sessions(task_id, started_at);

CREATE INDEX idx_focus_sessions_started
ON focus_sessions(started_at);

CREATE INDEX idx_projects_status_sort
ON projects(status, sort_order);
```

## 5. Core queries / derived data

### 5.1 Task accumulated time

Sum finalized sessions plus the live active session if that task is currently active.

Canonical finalized component:

```sql
SELECT COALESCE(SUM(finalized_duration_ms), 0)
FROM focus_sessions
WHERE task_id = ?
  AND ended_at IS NOT NULL;
```

### 5.2 Project accumulated time

Join sessions through tasks:

```sql
SELECT COALESCE(SUM(fs.finalized_duration_ms), 0)
FROM focus_sessions fs
JOIN tasks t ON t.id = fs.task_id
WHERE t.project_id = ?
  AND fs.ended_at IS NOT NULL;
```

### 5.3 Today / week / month / year / all time

Analytics should query sessions by `started_at`/time boundaries and include any finalized duration that belongs to those periods.

Important implementation note: a session may cross midnight/year boundaries. A simple `WHERE started_at BETWEEN ...` query is not enough for mathematically exact period attribution. Implement a domain/application helper that splits session duration across requested local-time boundaries when exact analytics are needed.

### 5.4 Year-over-year retention

Do not reset or overwrite prior-year sessions. Historical analytics are naturally retained because raw sessions stay in the database.

## 6. Delete semantics

Confirmed behavior: deleting a task removes that task's tracked time from task/project/global statistics.

Because `focus_sessions.task_id` uses `ON DELETE CASCADE`, deleting a task also deletes its sessions, which naturally removes the time from recomputed analytics.

UI must still require confirmation before destructive deletion.

## 7. Stop and Complete transaction flow

### Stop active task

Within one transaction:

1. Load active session.
2. Compute duration from timestamps.
3. Set `ended_at` and `finalized_duration_ms`.
4. Set task status to `in_progress`.
5. Commit.

### Complete active task

Within one transaction:

1. Finalize active session if present.
2. Set task status to `completed`.
3. Set `completed_at`.
4. Commit.

### Start another task

Within one transaction where possible:

1. Finalize current active session if present.
2. Set previous task to `in_progress` unless already completed.
3. Set selected task to `in_progress`.
4. Insert new `focus_sessions` row with `ended_at = NULL`.
5. Commit.

## 8. Crash / restart recovery

An active session may remain with `ended_at = NULL` after a crash or Windows restart.

On app startup:

1. Query for the active session.
2. Restore the task as Current Task.
3. Calculate elapsed time from `started_at`.
4. Do not silently discard time.

A later UX decision may add a recovery prompt for suspiciously long/offline intervals, but the database must preserve enough information to make that decision safely.

## 9. Backup compatibility

Backups must include at minimum the SQLite database file and enough metadata to identify the schema/app version.

Recommended export manifest if using an archive format later:

```json
{
  "app": "E-task",
  "schemaVersion": 1,
  "exportedAt": "UTC timestamp",
  "appVersion": "x.y.z"
}
```

Import must never assume an arbitrary file is a valid E-task database.

## 10. Migration plan

Initial migration suggestion:

`0001_initial.sql`

Contains:

- foreign key enablement/setup as supported by runtime
- projects
- tasks
- focus_sessions
- skills
- project_skills
- task_skills
- app_settings
- dashboard_widgets
- indexes

Future migrations must be additive/transformative and committed as new files such as:

- `0002_add_...sql`
- `0003_change_...sql`

Never rewrite an already-released migration to represent a new schema state.

## 11. Open schema questions

These should remain isolated until explicitly decided:

- Exact skill-time attribution when one task has multiple skills.
- Whether completed tasks need a separate archive flag later.
- Whether per-session history becomes a visible advanced feature.
- Whether AI/MCP changes need a persistent audit-log table.
- Whether cloud sync later requires stable device/version metadata.

Codex should not invent answers to these open questions if the implementation depends materially on them; ask first.
