# E-task — Product Specification

Repository mirror updated: 2026-08-18

This document is the persistent product contract available directly inside the repository. Codex must be able to implement E-task from this document plus `DECISIONS.md` without relying on the original ChatGPT conversation or external Notion access.

If a newer confirmed entry in `DECISIONS.md` conflicts with this file, the newer decision wins and this file should be updated.

## 1. Product idea

E-task is a lightweight Windows desktop application for managing projects and tasks through short focus sessions.

Default focus targets are **5 / 10 / 15 minutes**, with custom presets configurable in Settings.

E-task is **not** a strict Pomodoro timer. Reaching the selected target does not stop the timer. The timer continues until the user explicitly Stops or Completes the task.

Core product principle: starting should feel easy. Begin with a tiny session, continue naturally if focus appears, and keep accumulated work visible without punishment or pressure.

## 2. Core UX

- Home immediately shows the **Current Task** and a few **Next Tasks**.
- Main hierarchy is **Project → Task** only in v1.
- The app should reduce decision friction: on launch the user should immediately understand what to continue.
- A prominent **Resume / Continue** card should surface the last unfinished task and its accumulated time.
- The application should feel like a personal productivity control center, not a text notebook or generic to-do app.

## 3. Task states and actions

Task states:
- To do
- In progress
- Completed

Actions:
- **Start / Resume** — begins a new focus session.
- Only **one task can actively track time at once**.
- Starting a different task automatically stops the active task and starts the new one.
- **Stop** — ends the current session without completing the task. The task remains In progress. Stopped/paused time is not counted as work time.
- **Completed** — ends the active session, records work time and marks the task completed.
- **Delete** — requires user-facing confirmation. Deleting a task also removes that task’s tracked time from task/project/global aggregates.

## 4. Focus timer

Quick targets:
- 5 min
- 10 min
- 15 min
- custom presets configured in Settings

Behavior:
- Timer counts upward from `00:00`.
- Selected duration is a **target milestone**, not a hard stop.
- At the target, show a small notification and play a short, pleasant, non-annoying sound.
- Continue timing beyond the target until Stop or Completed.
- Progress visualization must continue beyond the target rather than appearing blocked or failed.

Positive stages:
- 0–5 min: Start
- 5–15 min: Focus
- 15–30 min: Flow
- 30+ min: Deep Work

Long focus must be framed positively. Do not use red overdue/punishment semantics for normal continued focus.

## 5. Time tracking

Track separately:
- current session time;
- accumulated time for the current task;
- accumulated time for each project;
- total tracked work time.

Primary stats periods:
- Today
- This week
- This month
- This year
- All time

Requirements:
- Retain historical yearly totals permanently.
- Support comparisons across weeks, months and years.
- Support historical period selection.
- Include an activity heatmap.
- Main task UI should show accumulated total time such as `7 min`, `20 min`, `1 h 12 min`.
- Detailed per-session history is not a main-screen priority and may be an advanced view later.

## 6. Skills and experience

Projects may contain one or multiple skills/categories, for example:
- After Effects
- Figma
- Blender
- Cinema 4D
- Illustrator
- Other

Experience is a tracked-practice indicator, not a professional certification.

Current proposed 15 levels:
1. First Steps — 0 h
2. Explorer — 10 h
3. Starter — 25 h
4. Learner — 50 h
5. Builder — 100 h
6. Practitioner — 200 h
7. Regular — 350 h
8. Skilled — 500 h
9. Experienced — 750 h
10. Advanced — 1,000 h
11. Seasoned — 1,500 h
12. Deep Practice — 2,500 h
13. Veteran — 4,000 h
14. Mastery Track — 6,500 h
15. Lifelong Craft — 10,000 h

Example UI: `After Effects — 482 h — Level 7`.

## 7. Dashboard

Home is the central experience.

Core content:
1. **Current Task hero card** — strongest visual focus, with task name, active timer, target, progress/overtime state, Stop, Completed and Delete.
2. **Resume / Continue** card — last unfinished task and accumulated time.
3. **Next Tasks** — a few upcoming tasks with quick start and target time.
4. Compact summary cards — Today / This Week / This Month / This Year / All Time.
5. Project Progress.
6. Skills / Experience summary.
7. A small number of useful analytics widgets such as weekly hours, gauges, progress bars or compact charts.

Dashboard requirements:
- support **compact and expanded** layouts;
- remain useful in smaller windows;
- dashboard cards/widgets should eventually be rearrangeable and hideable.

### Navigation

Confirmed navigation is a **horizontal rounded top navigation bar**, inspired by the user-provided EduRashi dashboard reference.

It should be compact, visually separated from the dashboard and primarily icon-driven while still understandable.

Main sections:
- Home
- Projects
- Analytics
- Skills
- Settings

Do not add Calendar, Notes, Goals, Meetings, generic Reports, or an Integrations page unless a newer confirmed product decision explicitly adds one.

## 8. Projects and task creation

Project contains:
- title;
- optional description;
- one or multiple skills/categories;
- status;
- total tracked time;
- related tasks.

Default task creation should stay minimal:
- Title
- Project
- Skill(s)
- Target (5 / 10 / 15 min or configured preset)

Task record also stores:
- status;
- accumulated work time;
- order / next position.

Priority and deadline are **not** part of the current minimal v1 creation flow.

## 9. ChatGPT / MCP integration

The application should eventually expose an MCP server so ChatGPT can act as a control and analysis interface.

Capabilities:
- read projects/tasks/status/current task/time/statistics;
- analyze productivity/progress patterns;
- create projects and tasks;
- edit tasks/projects;
- reorder tasks;
- complete tasks;
- delete tasks;
- break larger goals into short tasks.

Confirmation model:
- low-risk metadata edits such as a simple rename may be allowed without confirmation;
- meaningful structural, bulk, destructive or data-impacting actions require an explanation of the intended changes and explicit user approval before writing.

MCP should reuse the same application/domain service layer as the local UI rather than duplicating business rules.

## 10. Local storage and backup

Primary model: **local-first and offline-first**.

Current implementation direction: SQLite as the primary local source of truth.

Requirements:
- full offline functionality;
- fast startup/read performance;
- data survives app and Windows restarts;
- timer state can be restored safely after crash/restart;
- cloud must never be required for core operation.

Settings:
- Export backup
- Import backup
- Backup location
- Automatic backup: daily / weekly / off

Cloud recovery/sync may be added later as an optional feature.

## 11. Background operation / tray

Closing or hiding the main window should keep E-task running in the **Windows system tray / notification area** instead of terminating the process.

Only one E-task process may run at once. Launching the app again while it is in the tray must reopen/focus the existing window.

While hidden:
- active timer continues;
- CPU/RAM use remains low;
- tray icon can reopen the app;
- tray menu may expose Open, Stop timer, Complete task, Quit;
- target notifications still appear.

Timer implementation must calculate elapsed time from timestamps instead of persisting an increment every second.

## 12. Notifications

When a focus target is reached:
- show a small Windows notification;
- play a short soft sound;
- do not stop the session.

## 13. Startup / splash

Priority: fast startup.

- If initialization is effectively instant, open the app directly.
- If initialization is noticeable, show a very short splash while required local services/data initialize.
- Never add decorative startup delay.

## 14. Visual design

The three dashboard screenshots supplied by the user on 2026-08-18 are the **primary visual references**. They override older generic “Notion-like” descriptions.

Desired visual character:
- dashboard-first productivity control center;
- varied card sizes/proportions;
- strong Current Task hero;
- large glanceable numbers;
- useful gauges, progress bars, line/bar charts and mini visualizations;
- icons, badges and compact status indicators instead of long text blocks;
- solid rounded cards;
- subtle borders/shadows;
- no glassmorphism or unnecessary transparency;
- high information density but calm grouping and hierarchy.

### Current Task psychological hierarchy

- Task name/immediate action must be clearly visible.
- Circular progress/gauge is the primary sense of progress.
- Exact timer remains visible but should not dominate like a deadline countdown.
- Target is a small achievable milestone.
- Continued/overtime work is positive.
- Communicate progress and continuation, not urgency or failure.

### Timer visualization

Use a combination of:
- primary circular timer/progress gauge;
- secondary linear focus-stage/progress indicator.

### Themes and accent

Light:
- white / soft gray surfaces;
- white cards;
- thin borders;
- subtle shadows.

Dark:
- black / near-black background;
- very dark graphite surfaces;
- light typography;
- restrained borders;
- one strong selective accent.

Use curated accent presets instead of unrestricted color picking for the primary direction. **Yellow** is the current preferred/default accent family.

Languages:
- Ukrainian
- English

## 15. Settings

At minimum:
- Light / Dark theme
- curated accent palette selection
- Ukrainian / English language
- custom focus target presets
- notification sound settings
- Export backup
- Import backup
- backup location
- automatic backup daily / weekly / off
- app/window sizing or compactness preference
- optional startup behavior

AI assistant:
- provider selection between OpenAI and Gemini;
- provider, model and API-key management live in Settings while the AI page remains a focused chat experience;
- user-supplied OpenAI and Gemini API keys persist separately in Windows Credential Manager and are excluded from SQLite, browser/session storage and backups;
- stored secret values never return to the renderer; the interface receives only whether each provider is configured;
- model name selection;
- clear disclosure of which local context is sent to the selected provider;
- explicit consent before the first AI request and an option to exclude raw focus-session history;
- connection testing that validates the saved key and selected model without generating a chat response;
- analysis of tasks, projects and focus history;
- editable task/project proposals rendered as confirmation cards, with a summarized Apply all flow;
- tasks proposed alongside a new project must remain linked to that project when the batch is applied;
- chat supports stopping an active request, retrying a failed request and scrolling to new responses;
- no silent or destructive AI mutations.

## 16. Performance goals

The app must:
- launch quickly;
- remain responsive;
- use little CPU when idle/backgrounded;
- keep RAM use modest;
- track correctly with the main UI hidden;
- avoid unnecessary animation loops, polling and background work.

## 16.1 Windows installation and updates

- Distribute E-task as a per-user NSIS Windows installer.
- Versions use SemVer and are published through GitHub Releases.
- The app automatically checks GitHub Releases after startup and also supports a manual check.
- When an update is available, show an in-app modal with release version, animated download/install progress and clear restart state.
- The app can download, verify and install a newer signed release without sending the user to a browser or requiring a manual installer download.
- Replacing application files during an update must not delete or reset local SQLite data.
- The update signing private key must never be stored in source control.

## 17. Current implementation direction

Repository: `Validolio11/E-task-manager`

Current stack:
- Tauri 2
- React
- TypeScript
- Vite
- SQLite via the Tauri SQL plugin

Architectural priorities:
1. Correct timer/session model and data integrity.
2. Domain/application logic independent from React where practical.
3. Persistence behind repository/service interfaces.
4. Timestamp-based timer math that is testable as pure logic.
5. Low background resource usage.
6. Shared application services so future MCP uses the same business rules as the UI.

## 18. Still-open product decisions

These are not permission for Codex to invent behavior. Ask only if a task is blocked by them.

- final product name;
- final logo/icon;
- optional cloud backup/sync provider;
- whether advanced per-session history is exposed;
- exact MCP transport/auth model;
- whether skill selection is mandatory or optional by default;
- exact yellow-led accent palette and stage colors;
- exact icon sizing/spacing/labels/active state for top navigation;
- exact breakpoints/rules for compact vs expanded dashboard.
