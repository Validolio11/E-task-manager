# Windows releases and automatic updates

E-task uses SemVer (`MAJOR.MINOR.PATCH`). Keep the version synchronized in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

## v0.2.11

- Made selecting a task separate from starting its timer, with an explicit Play action for queued tasks.
- Fixed compact-window scaling so the main scrollbar stays on the far-right edge without horizontal overflow.
- Reduced unnecessary app-wide timer renders while keeping active timers, targets and date-based views current.
- Kept finalized focus durations consistent across analytics and AI whole-minute summaries.
- Improved confirmation-dialog keyboard focus, Escape handling, focus restoration and duplicate-submit protection.
- Added regression coverage for duration calculations, AI minute rounding and task-selection behavior.

## v0.2.10

- Added historical focus analytics for week, month and year with period navigation and comparisons.
- Improved the active timer with positive overtime feedback and timestamp-driven focus-stage progress.
- Made the activity heatmap usable with pointer, touch and keyboard input while exposing exact daily values.
- Improved compact-window KPI layouts, typography and light-theme surface contrast.
- Kept the five-section primary navigation focused and moved AI Assistant to an accessible secondary top-bar action.
- Added regression tests for focus presentation, calendar period boundaries, leap-day buckets and sessions crossing period boundaries.

## v0.2.9

- Replaced the application branding with the exact approved white-background E-task logo variant and regenerated the Windows/Tauri icons.
- Normalized the interface around shared SaaS design tokens with restrained 16px card radii, 12px grid gaps, spacious card interiors, softer shadows and calmer motion.
- Reorganized Settings into a desktop sidebar with a responsive tablet layout.
- Improved modal width, form spacing, typography, scrollbar treatment and primary-action hierarchy.
- Recorded strict reference-fidelity rules so supplied brand assets are not redrawn, recolored or substituted.

## v0.2.8

- Reworked Settings into clear Interface, AI Assistant, and Data & Updates sections.
- Fixed the top bar overlapping page content and improved responsive project navigation at narrow window sizes.
- Improved typography, contrast, spacing, focus states, control sizes, and dark-theme readability across the app.
- Added accessible in-app confirmation dialogs for destructive and bulk AI actions instead of browser alerts.
- Made Analytics easier to read with exact daily values, an explained activity heatmap, and accessible labels.
- Improved AI chat density, key-status feedback, and API-key management readability.

## v0.2.7

- Fixed Home and Analytics dates staying stale while the app remained open without an active timer.
- Fixed previous-month and previous-year comparisons for calendar periods of different lengths.
- Made daily and weekly analytics safe across local daylight-saving time changes.
- Prevented damaged preference JSON from blocking projects, tasks and sessions from opening.
- Reset stale retry and error state when clearing the AI chat.
- Improved AI connection-state feedback and rejected invalid non-finite focus targets.
- Verified responsive project, task and timer flows, including the top-bar overlap regression.
- Updated the version script to keep `package-lock.json` synchronized automatically.

## v0.2.6

- Added persistent OpenAI and Gemini API keys through Windows Credential Manager.
- Moved AI provider, model and API-key management into Settings.
- Kept the AI page focused on chat, local-context analysis and confirmed actions.
- Fixed unreadable text contrast on AI action cards in the dark theme.
- Added connection checks, friendly API errors, request cancellation and retry.
- Added explicit data-sharing consent and an option to exclude focus-session history.
- Added editable AI proposals, Apply all confirmation and reliable new-project task linking.

## v0.2.0

- Replaced static demo data with real local projects, tasks and focus sessions.
- Added SQLite migrations and restart-safe timestamp-based timers.
- Added complete Home, Projects, Analytics, Skills and Settings screens.
- Added create/edit/delete and Start/Resume/Stop/Complete workflows.
- Added light/dark/system themes, accent palettes, compact mode and custom focus presets.
- Added JSON backup/export, native target notifications and system tray behavior.
- Added automated domain tests for timing, period boundaries and experience levels.

## One-time repository setup

1. Store the updater private key in the GitHub repository secret `TAURI_SIGNING_PRIVATE_KEY`.
2. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The initially generated key has no password, so this secret can be empty or omitted.
3. Keep an offline backup of the key. Never commit it; `private/` is ignored.

The matching public key is embedded in `tauri.conf.json`. Existing app installations will only accept updates signed by that private key.

## Publishing a release

1. Run `npm run version:set -- 0.2.0` to update all four version files safely.
2. Commit the version change.
3. Create and push a tag, for example `v0.2.6`, or push the version commit to `main` with `[release]` in its commit message.

The release workflow builds the Windows NSIS `setup.exe`, signs the updater artifact, publishes the GitHub Release, and generates `latest.json`. Installed copies read that manifest and can install the update from the app.
