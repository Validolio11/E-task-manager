# Windows releases and automatic updates

E-task uses SemVer (`MAJOR.MINOR.PATCH`). Keep the version synchronized in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

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

1. Run `npm run version:set -- 0.2.0` to update all three version fields safely.
2. Commit the version change.
3. Create and push a tag, for example `v0.2.6`, or push the version commit to `main` with `[release]` in its commit message.

The release workflow builds the Windows NSIS `setup.exe`, signs the updater artifact, publishes the GitHub Release, and generates `latest.json`. Installed copies read that manifest and can install the update from the app.
