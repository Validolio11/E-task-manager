# E-task agent guide

This repository contains the Windows-first E-task desktop application.

`AGENTS.md` is the **entry point and context map**, not the full product encyclopedia. Before implementing any meaningful task, read the repository documentation below.

## Mandatory context order

1. Read this file.
2. Read `docs/README.md`.
3. Read `docs/product/PRODUCT_SPEC.md`.
4. Read `docs/product/DECISIONS.md` and identify the newest decisions relevant to the task.
5. Read `docs/CODEX_WORKFLOW.md`.
6. Inspect the code/tests relevant to the requested change.

A fresh Codex session must be able to understand the product from the repository alone. Do not rely on memory of previous chats.

## Instruction precedence

When sources conflict:

1. Current explicit user/task instruction wins.
2. More-specific applicable `AGENTS.override.md` or deeper `AGENTS.md` files win inside their directory scope.
3. This root `AGENTS.md` applies repository-wide.
4. Newer confirmed dated decisions in `docs/product/DECISIONS.md` override older conflicting product text.
5. `docs/product/PRODUCT_SPEC.md` defines the persistent product contract.
6. Older notes and existing code behavior are lower priority.

If a real conflict remains and the correct behavior would materially affect UX, architecture or data integrity, ask the user instead of guessing.

## Product guardrails

Build only features that belong to E-task. Do not turn it into a generic productivity suite.

Core constraints:
- V1 hierarchy is `Project → Task` only.
- Only one task can actively track time at once.
- Main states: To do, In progress, Completed.
- Start/Resume starts a focus session.
- Stop ends the session without completing the task; stopped time is not counted.
- Completed records time and completes the task.
- Delete requires confirmation and removes that task’s tracked time from aggregates.
- Focus targets: 5 / 10 / 15 minutes plus custom configured presets.
- Target is never a hard stop; timing continues after target.
- Continued focus is positive: Start → Focus → Flow → Deep Work.
- Local-first / offline-first; SQLite is the primary local source of truth.
- Timer calculations must be timestamp-based.
- Do not add Calendar, Notes, Goals, Meetings, generic Reports or a generic Integrations page unless a newer confirmed decision explicitly adds them.

## Visual direction

- Dashboard-first personal productivity control center.
- Horizontal rounded icon-first top navigation.
- Main sections: Home, Projects, Analytics, Skills, Settings.
- Strong Current Task hero card.
- Varied card sizes, large glanceable numbers, gauges/progress/charts where useful.
- Solid rounded cards; no glassmorphism.
- Light and dark themes.
- Dark theme is near-black/graphite with a selective accent.
- Current preferred/default accent family: curated yellow palette.
- Current Task should emphasize immediate action and progress rather than deadline pressure.
- Primary timer visual: circular gauge plus secondary linear stage indicator.

See `docs/product/PRODUCT_SPEC.md` for the complete product behavior.

## Engineering direction

Current stack:
- Tauri 2
- React
- TypeScript
- Vite
- SQLite via Tauri SQL plugin

Priorities:
1. Correct timer/session model and data integrity.
2. Fast startup and low background CPU/RAM.
3. Typed domain/application boundaries.
4. Persistence behind repositories/services.
5. Domain logic independent from React where practical.
6. Shared application services so future MCP can reuse the same business rules.
7. Avoid unnecessary dependencies, polling and animation loops.

## Coding rules

- TypeScript strict mode.
- Prefer small typed modules over large components.
- Domain types/application services must not depend on React.
- Keep mock/demo data clearly isolated until persistence is wired.
- Never fake persistence once SQLite is connected.
- Add migrations rather than mutating released schema in place.
- Keep timer math testable as pure functions where possible.
- Add/update tests for behavior that can regress.
- Run relevant build/test/check commands before finishing when the environment supports them.

## Documentation rule

When the user confirms a new product or architecture decision:

1. Add a dated entry to `docs/product/DECISIONS.md`.
2. Update `docs/product/PRODUCT_SPEC.md` if the persistent contract changed.
3. Remove or rewrite contradictory older text.
4. Update this file only when repository-wide agent rules change.

Do not allow a new implementation shortcut to silently become a product decision.
