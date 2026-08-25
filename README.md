# E-task 0.3.1

Minimal focus-first task manager rebuilt in React from the approved Focus Dock design.

## Features

- selecting a task never starts its timer;
- explicit focus start, pause, resume, and completion;
- task creation, editing, deletion, and full emoji picker;
- compact task dock, complete task list, and local AI assistant;
- touch-friendly responsive layout and local browser persistence.

## Development

```bash
pnpm install
pnpm dev
```

```bash
pnpm test
pnpm build
```

## Windows app

Run the desktop app in development mode:

```bash
pnpm desktop:dev
```

Create the Windows NSIS installer:

```bash
pnpm desktop:build
```

The installer is written to `src-tauri/target/release/bundle/nsis/`.
