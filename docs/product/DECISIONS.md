# E-task confirmed decisions

This is the chronological decision log for confirmed product and architecture choices.

**Rule:** when a newer entry conflicts with older documentation, the newer confirmed entry wins and the conflicting product spec should be updated in the same change.

## 2026-08-18 — Product scope

- E-task is a new, focused Windows productivity control center, not a clone of another app.
- V1 hierarchy is `Project → Task`; no deeper nesting.
- Main task states: To do, In progress, Completed.
- No Calendar, Notes, Goals, Meetings, generic Reports hub, or generic Integrations page unless explicitly approved later.

## 2026-08-18 — Timer model

- Quick targets: 5 / 10 / 15 minutes, with custom presets in Settings.
- Timer counts upward.
- Target is a milestone, not a stop condition.
- At target, show a small notification and play a pleasant, non-annoying sound; continue timing.
- Positive focus stages: Start → Focus → Flow → Deep Work.
- Pause/Stop time is not counted.
- Only one task may actively time at once.
- Starting a different task automatically stops the active task and starts the selected task.

## 2026-08-18 — Task actions and tracked time

- Start/Resume begins a new session on a task.
- Stop ends the current session but leaves the task In progress.
- Completed records the running time and marks the task completed.
- Delete requires confirmation.
- Deleting a task removes that task’s previously tracked time from task/project/global aggregates.
- Main UI prioritizes accumulated total time per task over detailed per-session history.

## 2026-08-18 — Analytics

- Time periods: Today, This week, This month, This year, All time.
- Historical yearly totals must be retained.
- Analytics should support comparisons across weeks, months, and years.
- Include an activity heatmap.

## 2026-08-18 — Skills and experience

- Projects may include one or multiple skills/categories.
- Example skills: After Effects, Figma, Blender, Cinema 4D, Illustrator, Other.
- Experience is based on tracked practice time and must not be presented as objective professional certification.
- Current model uses 15 experience levels described in `PRODUCT_SPEC.md`.

## 2026-08-18 — Dashboard and navigation

- Dashboard is the main product experience: a personal productivity control center.
- Current Task is the strongest hero card.
- Home also includes Resume, Next Tasks, compact time summaries, Project Progress, Skills/Experience, and a small number of useful analytics widgets.
- Dashboard cards should eventually be rearrangeable/hideable.
- App should support compact and expanded layouts.
- Navigation is a **horizontal rounded top navigation bar**, inspired by the user-provided EduRashi reference.
- Main sections: Home, Projects, Analytics, Skills, Settings.

## 2026-08-18 — Visual direction

- Three user-provided dashboard screenshots are the primary visual references.
- Dashboard-first, visually rich, information-dense but calm.
- Varied card sizes, large numbers, gauges, progress bars, compact charts, icons and badges.
- Solid rounded cards; no glassmorphism.
- Light and Dark themes.
- Dark theme: black/near-black with very dark graphite surfaces and one strong selective accent.
- Curated preset palette, with yellow as the current preferred/default accent family.
- Current Task should emphasize immediate action and progress rather than deadline pressure.
- Primary timer visualization: circular gauge plus secondary linear stage/progress indicator.

## 2026-08-18 — Data and background behavior

- Local-first and offline-first.
- SQLite is the primary local source of truth.
- Timer state must survive restart/crash safely.
- Timer elapsed time must be calculated from timestamps rather than writing a counter every second.
- Closing/hiding the main window leaves the app running in the Windows tray/notification area.
- Target notifications still appear while the main window is hidden.
- Backup: export, import, backup location, automatic daily/weekly/off.

## 2026-08-18 — ChatGPT / MCP

- Future MCP server should expose projects, tasks, status, current task, time and statistics.
- It should support read/analyze/create/edit/reorder/complete/delete and breaking goals into short tasks.
- Low-risk metadata edits may be performed without confirmation.
- Meaningful structural, bulk, destructive, or data-impacting changes require an explanation and explicit approval before write.

## 2026-08-18 — Repository and development stack

- Official repository: `Validolio11/E-task-manager`.
- Default branch: `main`.
- Initial development branch: `codex/initial-app-scaffold`.
- Current implementation direction: **Tauri 2 + React + TypeScript + Vite + SQLite**.
- Working product name in code may remain `E-task` until final naming is approved.
- Repository documentation must be sufficient for a fresh Codex session to understand the product without access to the original chat.

## 2026-08-18 — Windows distribution and updates

- E-task is distributed as a per-user NSIS Windows installer built by GitHub Actions.
- Application versions follow SemVer and are published as GitHub Releases.
- Installed apps check the latest GitHub Release manifest and may download/install signed updates without losing local SQLite data.
- Updater packages must be cryptographically signed; the private key is stored only as a GitHub repository secret and in a secure offline backup.
- The approved application icon uses the yellow focus/lightning/check motif on a near-black rounded square.
