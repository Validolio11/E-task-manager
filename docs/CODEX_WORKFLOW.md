# Codex workflow for E-task

Last updated: 2026-08-18

This file tells Codex how to work on E-task without inventing product behavior or losing context.

## Before editing code

1. Read `/AGENTS.md`.
2. Read `/docs/README.md`.
3. Read `/docs/product/PRODUCT_SPEC.md`.
4. Read `/docs/product/DECISIONS.md` and identify the newest decisions related to the task.
5. Inspect the existing implementation and tests.
6. Restate the implementation goal internally in terms of the confirmed product contract.

Do not infer missing product features from other productivity apps.

## When to ask the user a question

Ask only when a decision is genuinely blocking implementation or would materially change behavior, data integrity, architecture, or UX.

Good reasons to ask:
- two confirmed requirements conflict;
- a destructive data behavior is unspecified;
- a platform limitation forces a product tradeoff;
- a visual decision has multiple materially different outcomes and no existing decision resolves it.

Do not ask for routine implementation choices that can be made safely from the existing spec.

## Product guardrails

E-task is not a generic productivity suite. Do not add Calendar, Notes, Goals, Meetings, generic Reports, or an Integrations page unless a newer confirmed decision explicitly introduces them.

Keep the v1 hierarchy `Project → Task` only.

Only one task can be actively timing at once.

The focus duration is a target, not a hard stop. Timing continues after the target until Stop or Completed.

Longer focus is positive. Avoid red overdue/punishment semantics for normal focus continuation.

## Engineering workflow

For each implementation task:

1. Identify the smallest coherent slice.
2. Prefer domain/application logic independent from React.
3. Keep persistence behind repository/service interfaces.
4. Keep timer math timestamp-based and testable.
5. Add or update tests for behavior that can regress.
6. Run the relevant checks before finishing.
7. Review the diff for accidental feature creep or unrelated refactors.
8. Update documentation when a confirmed product/architecture decision changed.

## Validation expectations

At minimum, when the project supports these commands, run:

```bash
npm install
npm run build
npm run test
```

For Tauri/Rust changes also run the available Rust/Tauri validation commands, for example:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

If a command is unavailable or the environment cannot run it, state that clearly in the task/PR summary rather than pretending validation passed.

## Git / PR behavior

- Keep changes focused and reviewable.
- Do not rewrite or amend unrelated existing commits.
- Keep fixes on the current development version until the user explicitly approves a version bump.
- Never create a release tag, run the release workflow or publish a GitHub Release without approval for that specific release.
- Use clear commit messages.
- Summarize what changed, why, tests/checks run, and any unresolved decisions.
- Never silently change the product spec to match an implementation shortcut.

## Decision precedence

For Codex work in this repository, interpret instructions in this order:

1. Current explicit user request / task prompt.
2. Applicable `AGENTS.override.md` / deeper `AGENTS.md` instructions, if present.
3. Root `/AGENTS.md`.
4. Newest confirmed dated entry in `/docs/product/DECISIONS.md`.
5. `/docs/product/PRODUCT_SPEC.md`.
6. Older design notes or existing code behavior.

If two sources still conflict and the correct outcome is not obvious, stop and ask the user.

## New decisions

When the user confirms a new requirement:

- record it in `docs/product/DECISIONS.md` with an ISO date;
- update `PRODUCT_SPEC.md` if it changes the persistent product contract;
- remove or rewrite obsolete contradictory text;
- only then implement against the updated contract.

The goal is that a fresh Codex session can understand E-task correctly without access to the original ChatGPT conversation.
