# E-task V1 Implementation Plan

This plan turns the confirmed product and architecture into an ordered development path. Codex should work through it incrementally, keep the app runnable, and avoid jumping to later features before core timer/data integrity is stable.

## Current implementation checkpoint — v0.2.0

Implemented and wired to real local data:

- React/Tauri application scaffold and horizontal navigation;
- domain time/period/experience helpers with automated unit tests;
- SQLite migration and desktop persistence, with localStorage fallback for browser preview;
- project and task create/edit/delete flows with confirmation for destructive actions;
- one-active-session invariant, Start/Resume/Stop/Complete and restart-safe timestamp timing;
- real Home aggregates, weekly chart, 12-week activity heatmap and session history;
- practice/skill level summaries;
- theme, accent, compactness, focus presets and target sound settings;
- JSON backup export/import;
- native target notifications and tray Open/Quit behavior;
- signed GitHub Releases and automatic updater.

Still planned after this checkpoint:

- drag-and-drop task ordering and dashboard widget ordering;
- multiple skills per project/task instead of one primary project skill in the current UI;
- tray Stop/Complete actions backed by a Rust/domain command layer;
- automatic scheduled backup and user-selected backup directory;
- broader integration/E2E coverage and future MCP exposure.

## 0. Working rules

Before implementing any phase:

1. Read `/AGENTS.md`.
2. Read `docs/product/PRODUCT_SPEC.md`.
3. Read `docs/product/DECISIONS.md` for newer confirmed decisions.
4. Read `docs/ARCHITECTURE.md` and `docs/DATABASE_SCHEMA.md`.
5. Inspect the current code/tests before changing structure.

When a confirmed product or architecture decision changes during development, update documentation in the same branch/PR.

## Phase 1 — Stabilize application scaffold

Goal: a clean, reproducible Tauri + React + TypeScript application that starts reliably.

Tasks:

- Verify Vite/React dev build.
- Verify Tauri dev build on Windows.
- Enable TypeScript strict mode.
- Add basic lint/typecheck/test scripts if missing.
- Establish source folders following `ARCHITECTURE.md`.
- Keep the initial Home dashboard but isolate mock/demo data.
- Confirm horizontal top navigation contains only Home, Projects, Analytics, Skills, Settings.
- Ensure no Calendar/Notes/Goals/Meetings/Reports/Integrations modules are introduced.

Exit criteria:

- `npm install` succeeds.
- frontend typecheck/build succeeds.
- `tauri dev` can launch the shell in a prepared Windows environment.
- UI scaffold renders without business logic hidden inside large components.

## Phase 2 — Domain model and pure timer logic

Goal: establish testable business rules before wiring SQLite.

Implement domain types:

- Project
- Task
- TaskStatus
- FocusSession
- Skill
- ExperienceLevel
- Timer/FocusStage

Implement pure functions for:

- elapsed time from timestamps
- target progress
- Start / Focus / Flow / Deep Work stage mapping
- accumulated session duration
- project progress from tasks
- experience level from tracked hours
- date-period helpers required by analytics

Add unit tests for:

- timer continues beyond target
- correct focus-stage transitions
- Stop and Complete semantics at domain level
- experience-level boundaries

Exit criteria:

- domain has no React/Tauri/SQLite imports
- timer math is covered by tests

## Phase 3 — SQLite foundation and migrations

Goal: create the real local source of truth.

Tasks:

- Configure Tauri SQL plugin correctly.
- Create initial migration based on `docs/DATABASE_SCHEMA.md`.
- Add database initialization module.
- Enable/verify foreign keys.
- Create SQLite repository implementations for Projects, Tasks, Sessions, Skills and Settings.
- Add repository integration tests where practical.
- Add seed/default skills only if the UI needs them; preserve user-editable architecture.

Exit criteria:

- fresh install creates DB successfully
- migrations are repeatable
- CRUD repository tests pass
- data survives application restart

## Phase 4 — Project and Task CRUD

Goal: replace dashboard mocks with real data management.

Project capabilities:

- create project
- edit title/description/skills
- list projects
- complete/archive project only as supported by current spec

Task capabilities:

- create task with Title, Project, Skill(s), Target
- edit task
- reorder tasks
- list next tasks
- delete task with confirmation
- completed task state

Important:

- no Priority/Deadline in default V1 creation flow
- preserve `Project -> Task` hierarchy only

Exit criteria:

- user can create a project and several tasks
- closing/reopening app preserves them
- ordering is stable

## Phase 5 — Real timer service

Goal: implement the defining E-task workflow.

Tasks:

- `startTask(taskId)`
- `resumeTask(taskId)`
- `stopCurrentTask()`
- `completeCurrentTask()`
- enforce one active session
- automatically finalize old session when another task starts
- persist target duration for each session
- calculate live elapsed time from timestamps
- restore active session after app restart/crash

UI wiring:

- Current Task hero uses real task/session data
- circular gauge uses real target progress
- linear indicator shows positive continued-work stage
- Stop, Completed, Delete actions are functional
- Resume card uses last unfinished task
- Next Tasks start real sessions

Exit criteria:

- only one timer can be active
- timer does not stop at 5/10/15 target
- stopped time is not counted
- task accumulated time is correct after multiple sessions
- restart restores Current Task safely

## Phase 6 — Target notification

Goal: notify at target without interrupting focus.

Tasks:

- detect target crossing once per session
- Windows notification
- soft configurable sound
- persist `target_notification_sent`
- notification works while main window is hidden
- timer continues after notification

Exit criteria:

- no duplicate notifications for one target/session
- notification does not stop/complete task

## Phase 7 — Tray and background lifecycle

Goal: make E-task behave like a lightweight Windows utility.

Tasks:

- closing/hiding window keeps process alive in tray
- tray icon
- tray actions: Open, Stop timer, Complete task, Quit
- active timer remains valid while hidden
- avoid high-frequency background database writes
- verify clean explicit Quit behavior

Exit criteria:

- main UI can be hidden without losing timer
- tray can restore UI
- Stop/Complete from tray uses the same application services as UI

## Phase 8 — Real Home dashboard aggregates

Goal: replace remaining static metrics with derived data.

Cards/metrics:

- Current Task
- Resume
- Next Tasks
- Today
- This Week
- This Month
- This Year
- All Time
- Project Progress
- Skills/Experience summary

Tasks:

- analytics queries/services based on focus sessions
- include active-session elapsed time in current views
- keep historical years separate
- handle local-time date boundaries correctly

Exit criteria:

- dashboard metrics match underlying sessions
- deleting a task removes its time from aggregates as specified

## Phase 9 — Projects screen

Goal: complete the dedicated project/task management experience.

Expected features:

- project list/cards
- project progress
- total project time
- task list by status
- drag/reorder tasks
- quick Start/Resume
- create/edit/delete flows

Keep visual direction consistent with the primary dashboard references and the horizontal navigation decision.

## Phase 10 — Analytics screen

Goal: provide useful time insight without turning the product into a generic reports suite.

Implement:

- week/month/year/all-time selection
- historical year selection
- comparison with previous period where useful
- weekly/monthly hours charts
- activity heatmap
- project time breakdown
- skill time breakdown

Avoid artificial Productivity Score unless later explicitly approved.

Exit criteria:

- 2026/2027/etc. data can be viewed independently
- period comparisons are based on real tracked data

## Phase 11 — Skills and Experience screen

Goal: expose tracked-practice progression.

Implement:

- skill list
- tracked hours per skill
- 15-level experience calculation from Product Spec
- current level and progress toward next level
- clear wording that this represents tracked practice/experience, not professional certification

Open dependency:

- if a task can have multiple skills, exact duration attribution policy must be confirmed before final skill totals are considered authoritative.

## Phase 12 — Settings

Goal: complete user-controlled app behavior.

Implement:

- Light / Dark
- curated accent palette, yellow default direction
- Ukrainian / English
- custom timer presets
- notification sound settings
- compactness/window preferences
- backup settings
- optional startup behavior

Persist settings through `SettingsService`, not directly from components to raw SQLite calls.

## Phase 13 — Backup / restore

Goal: make local data safely portable/recoverable.

Implement:

- Export backup
- Import backup
- Backup location
- Automatic daily / weekly / off
- schema/app-version validation
- safety backup before import

Test restore with real projects/tasks/sessions.

## Phase 14 — Dashboard customization

Goal: implement the confirmed customizable-dashboard direction after core content is stable.

Implement:

- reorder dashboard cards
- hide/show supported widgets
- compact vs expanded layout behavior
- persist widget layout

Do this after core dashboard metrics are correct so layout code does not block core development.

## Phase 15 — MCP foundation

Goal: expose the mature application-service layer to ChatGPT/Codex-compatible MCP clients.

Do not build MCP by directly manipulating SQLite tables.

Expose operations through existing services:

Read:

- projects
- tasks
- statuses
- current task
- time totals
- analytics
- skills

Write:

- create/edit/reorder
- complete
- delete

Confirmation model:

- low-risk metadata changes may follow the current product rule
- meaningful/destructive/bulk actions require an explicit confirmation flow

Add validation and permission boundaries before enabling destructive tools.

## Phase 16 — Polish and performance

Goal: prepare a stable V1 build.

Tasks:

- profile startup
- profile idle CPU/RAM
- remove unnecessary polling/re-renders
- keyboard accessibility
- focus states/tooltips
- empty states
- error states
- responsive Compact/Expanded modes
- light/dark visual consistency
- verify notification/tray lifecycle
- verify DB recovery behavior
- packaging/signing strategy as appropriate

## Suggested implementation slices / PRs

Keep changes reviewable. Suggested sequence after the initial scaffold PR:

1. `domain-timer-model`
2. `sqlite-foundation`
3. `project-task-crud`
4. `focus-timer-service`
5. `notifications-tray`
6. `dashboard-real-data`
7. `projects-screen`
8. `analytics-screen`
9. `skills-experience`
10. `settings-backup`
11. `dashboard-customization`
12. `mcp-foundation`
13. `v1-polish`

## Definition of V1 core

The app is not considered functionally useful merely because the dashboard looks correct.

Minimum usable V1 core requires:

- persistent projects/tasks
- one active timestamp-based timer
- Start/Resume/Stop/Completed/Delete
- target notification without hard stop
- accumulated task/project time
- Today/Week/Month/Year/All Time
- restart recovery
- tray/background operation
- basic Skills tracking
- Settings with timer presets/theme/language
- backup export/import

Analytics richness, dashboard rearrangement and MCP can follow after this core is stable, but the architecture must preserve room for them from the beginning.

## When Codex must ask a question

Ask before implementation if a task materially depends on an unresolved product choice, especially:

- skill-time attribution across multiple skills
- behavior for suspicious active timers after long shutdown/offline periods
- final product naming/branding
- major new dependency/framework
- data-destructive migration
- changing confirmed navigation or core task/timer semantics

Do not ask for minor implementation details that can be safely chosen within the documented architecture.
