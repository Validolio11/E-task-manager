# E-task 0.3.2

Minimal focus-first task manager rebuilt in React from the approved Focus Dock design.

## Features

- selecting a task never starts its timer;
- explicit focus start, pause, resume, and completion;
- task creation, editing, deletion, and full emoji picker;
- compact task dock, complete task list, and local AI assistant;
- optional OpenAI-compatible API connection with configurable endpoint, model, and key;
- touch-friendly responsive layout and local browser persistence.

The installed Windows app sends configured AI requests through its native layer. Direct AI requests from the browser preview require the API provider to allow CORS. API keys are never logged; when key persistence is enabled, the key is stored locally in the app data on that device.

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
