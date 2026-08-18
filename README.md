# E-task

Local-first Windows focus and task tracking application.

## Product direction

E-task is a lightweight productivity control center built around short focus sessions, a single active task, `Project → Task` hierarchy, accumulated time tracking, analytics, skill/experience tracking, and a low-pressure workflow.

## Current stack

- Tauri 2
- React + TypeScript
- Vite
- SQLite via the Tauri SQL plugin

## Start here — developers and Codex

Before making product or architecture changes, read:

1. [`AGENTS.md`](./AGENTS.md) — repository-wide agent/development rules and context map.
2. [`docs/README.md`](./docs/README.md) — documentation index and source-of-truth rules.
3. [`docs/product/PRODUCT_SPEC.md`](./docs/product/PRODUCT_SPEC.md) — full current product contract.
4. [`docs/product/DECISIONS.md`](./docs/product/DECISIONS.md) — confirmed dated decisions; newer decisions override older conflicting text.
5. [`docs/CODEX_WORKFLOW.md`](./docs/CODEX_WORKFLOW.md) — workflow for planning, implementing, validating and documenting Codex changes.

The repository documentation is intentionally designed so a fresh Codex session does **not** need the original ChatGPT conversation to understand the app.

## Windows installer

Run `npm run desktop:build` on Windows to create the NSIS installer. Tagged versions are built and published automatically by `.github/workflows/release.yml`; see [`docs/RELEASES.md`](./docs/RELEASES.md).

## Development status

Version 0.2 is a usable local-first milestone on `main`. It includes real project/task CRUD,
timestamp-based focus sessions, SQLite persistence and migrations, derived analytics, skill
practice levels, themes, configurable focus presets, JSON backup/import, native target
notifications, system-tray behavior and signed GitHub Release updates.

When a new product decision is confirmed, update the decision log and product spec so future Codex sessions always receive the newest instructions.
