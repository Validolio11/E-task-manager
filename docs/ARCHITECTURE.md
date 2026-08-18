# E-task Architecture

This document defines the implementation architecture for the E-task desktop application. It is subordinate to the confirmed product requirements in `docs/product/PRODUCT_SPEC.md` and the dated decisions in `docs/product/DECISIONS.md`.

## 1. Architectural goals

The system must remain:

- Windows-first and desktop-native.
- Local-first and fully usable offline.
- Fast to launch and lightweight while idle or hidden in the tray.
- Safe for long-running timer state.
- Easy to test without the UI.
- Structured so the same application services can later be exposed through MCP.
- Simple enough for one developer / coding agent to maintain without unnecessary infrastructure.

## 2. Approved baseline stack

Frontend / desktop shell:

- Tauri 2
- React
- TypeScript
- Vite

Persistence:

- SQLite
- Tauri SQL plugin for desktop database access
- Schema migrations committed to the repository

The exact helper libraries may change, but do not introduce large frameworks when a small typed module is sufficient.

## 3. Layered architecture

Use the following dependency direction:

`UI -> application services -> domain -> repository interfaces -> infrastructure adapters`

The domain layer must never depend on React, Tauri, SQLite, or browser APIs.

### 3.1 Domain layer

Suggested location:

`src/domain/`

Responsibilities:

- Core types and invariants.
- Timer/session math.
- Project, task, skill and tracked-time models.
- Experience-level calculation.
- Pure aggregation helpers.

Examples:

- `Task`
- `Project`
- `Skill`
- `FocusSession`
- `TimerState`
- `ExperienceLevel`
- `calculateElapsedMs()`
- `calculateProjectProgress()`
- `calculateExperienceLevel()`

Rules:

- Prefer pure functions.
- No database calls.
- No React state.
- No Tauri APIs.
- No side effects where avoidable.

### 3.2 Application layer

Suggested location:

`src/application/`

Responsibilities:

- Orchestrate user actions.
- Enforce one active timer at a time.
- Start / resume / stop / complete tasks.
- Create, edit, reorder and delete tasks/projects.
- Recalculate aggregates after writes.
- Coordinate notifications and persistence.
- Provide use cases that can later be called by MCP.

Suggested services:

- `TaskService`
- `ProjectService`
- `TimerService`
- `AnalyticsService`
- `SkillService`
- `SettingsService`
- `BackupService`

Important rule: React components should call application services instead of containing business rules directly.

### 3.3 Repository contracts

Suggested location:

`src/application/ports/` or `src/repositories/`

Define interfaces for persistence before coupling services to SQLite.

Examples:

- `TaskRepository`
- `ProjectRepository`
- `SessionRepository`
- `SkillRepository`
- `SettingsRepository`

This keeps application logic testable with in-memory implementations and allows MCP to reuse the same service layer.

### 3.4 Infrastructure layer

Suggested location:

`src/infrastructure/`

Responsibilities:

- SQLite repository implementations.
- Tauri notification adapter.
- Tray adapter.
- Backup/import/export implementation.
- OS startup/autostart adapter if enabled later.
- File-system paths and app-data handling.

Possible structure:

```text
src/infrastructure/
  db/
    database.ts
    migrations/
    repositories/
  notifications/
  tray/
  backup/
```

### 3.5 UI layer

Suggested location:

`src/ui/` or organized under `src/components/`, `src/features/`, and `src/pages/`.

Main product sections:

- Home
- Projects
- Analytics
- Skills
- Settings

Do not create Calendar, Notes, Goals, Meetings, generic Reports, or Integrations pages unless a later confirmed product decision explicitly adds them.

Recommended UI composition:

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    navigation/
    cards/
    controls/
  features/
    current-task/
    projects/
    tasks/
    analytics/
    skills/
    settings/
  pages/
    HomePage.tsx
    ProjectsPage.tsx
    AnalyticsPage.tsx
    SkillsPage.tsx
    SettingsPage.tsx
```

## 4. Timer architecture

The timer is a core integrity-sensitive feature.

### 4.1 Timestamp-based timing

Never persist an incrementing counter every second.

An active session should persist at minimum:

- session ID
- task ID
- `started_at`
- optional `stopped_at`
- target duration
- status

Displayed elapsed time is derived from timestamps.

Conceptually:

```text
elapsed = persisted_completed_duration + (now - active_session.started_at)
```

Use monotonic/UI updates for display where helpful, but persist source-of-truth timestamps and finalized durations.

### 4.1.1 Desktop process and SQLite write serialization

- Register Tauri's single-instance plugin before other plugins. A second launch focuses the existing main window.
- Serialize snapshot persistence in the frontend repository adapter.
- Do not span a transaction across separate Tauri SQL `execute()` calls: each command may check out a different pooled connection.
- Until the plugin exposes connection-bound transactions, use atomic idempotent upserts followed by ordered stale-row cleanup, with a bounded retry for transient SQLite lock errors.

### 4.2 One active task invariant

Only one task may have an active focus session.

When the user starts another task:

1. Stop/finalize the currently active session.
2. Persist its duration.
3. Start the new session.
4. Update current-task state.

The transition should be performed atomically where possible.

### 4.3 Stop vs Complete

`Stop`:

- finalizes the active session
- task remains `in_progress`
- accumulated task time is preserved
- task becomes eligible for Resume

`Complete`:

- finalizes the active session if one exists
- task becomes `completed`
- accumulated time remains part of analytics

`Delete`:

- requires confirmation in the UI
- removes the task
- removes that task's session time from task/project/global aggregates according to the confirmed product decision

## 5. Data and analytics architecture

Store raw source events/data that allow aggregates to be recomputed.

Do not make summary cards the primary source of truth.

Primary persisted data should include:

- projects
- tasks
- focus sessions
- skills
- project-skill/task-skill links
- settings
- schema migration metadata

Analytics such as Today / Week / Month / Year / All Time should be derived from sessions and task relationships.

Optional cached aggregates may be added later only if profiling shows they are necessary.

## 6. Skills and experience

Tracked skill hours should come from sessions associated with task/project skills.

Experience levels are a presentation of tracked practice time, not a professional certification.

Keep the level thresholds in a single typed domain module so they are not duplicated across UI and analytics.

## 7. State management

Prefer the smallest solution that keeps state understandable.

Guideline:

- Server-style remote cache libraries are not needed for local SQLite by default.
- Keep domain/application state separate from purely visual UI state.
- A small app store/context may manage current task, settings and live timer display.
- Persistence must still go through application services/repositories.

Do not let a global UI store become the canonical database.

## 8. Tauri boundary

Keep Tauri-specific calls behind adapters.

Examples:

- notifications
- tray
- window visibility
- app-data paths
- backup file dialogs
- autostart

React components should not be filled with direct Tauri API calls.

## 9. Tray and background operation

Closing/hiding the main window should not terminate the process when tray mode is enabled.

Tray responsibilities:

- Open app
- Stop active timer
- Complete current task
- Quit

While hidden:

- timer source-of-truth remains valid through timestamps
- no high-frequency persistence loop
- target notification may still fire
- CPU/RAM use remains low

## 10. Notifications

Notification logic belongs in an application/infrastructure boundary, not inside a card component.

The target-reached event should:

1. Detect crossing of the selected target.
2. Emit only once for that session/target.
3. Show a small Windows notification.
4. Play the configured soft sound if enabled.
5. Continue the session without interruption.

## 11. Backup architecture

The primary SQLite database remains the source of truth.

Backup features should support:

- Export
- Import
- Configurable backup location
- Automatic daily / weekly / off

Import must validate backup compatibility before replacing live data.

Prefer a safe sequence:

1. validate
2. create safety backup of current DB
3. import/replace
4. run migrations if needed
5. reopen database

## 12. MCP architecture

MCP should be added after the core application-service layer is stable.

Important principle:

**MCP must call the same application services as the local UI.**

Do not implement a second set of task/timer rules specifically for AI.

Expected future capability groups:

- read projects/tasks/current task/stats
- analyze progress
- create/edit/reorder
- complete/delete

Higher-impact or destructive operations must preserve the confirmation model documented in the product spec.

## 13. Error handling

Use typed application errors where practical.

Examples:

- `TaskNotFoundError`
- `ProjectNotFoundError`
- `InvalidTaskStateError`
- `DatabaseError`
- `BackupValidationError`

UI should translate technical failures into concise user-facing messages.

Do not silently swallow persistence failures.

## 14. Windows distribution and update boundary

- Tauri produces a per-user NSIS installer on a Windows GitHub Actions runner.
- `tauri-action` publishes the installer, signed update archive, signature, and `latest.json` to GitHub Releases.
- The frontend updater plugin checks the static release manifest; the process plugin restarts only after a verified update installs.
- Update signatures and Windows executable signing are separate concerns. The updater private key stays outside Git and is injected only as a repository secret.
- User SQLite data lives outside the installed application bundle and must remain untouched by install/update replacement.
- Release versions are synchronized across npm, Cargo, and Tauri configuration using `scripts/set-version.mjs`.

## 15. Testing strategy

Priority order:

1. Domain unit tests for timer math and experience thresholds.
2. Application service tests with in-memory repositories.
3. SQLite repository integration tests.
4. UI component/interaction tests for critical flows.
5. End-to-end smoke tests for desktop lifecycle when practical.

Critical test cases:

- only one active task
- timer continues past target
- Stop does not complete task
- Complete finalizes time
- deleted task time disappears from aggregates
- restart restores valid timer state
- yearly analytics remain historically separated

## 16. Performance rules

- No unnecessary polling.
- No write-every-second timer persistence.
- Avoid heavyweight animation loops.
- Lazy-load non-critical screens if it materially improves startup.
- Query only the data needed for each view.
- Measure before adding caching complexity.

## 17. Decision rule for Codex

Before introducing a new architectural abstraction, dependency, background service, or database table, Codex should ask:

1. Is it required by the current Product Spec?
2. Does the existing architecture already provide a simpler place for it?
3. Will it make MCP reuse easier or harder?
4. Does it improve correctness, performance or maintainability enough to justify its complexity?

If the answer is unclear, ask the user before making a large structural change.
