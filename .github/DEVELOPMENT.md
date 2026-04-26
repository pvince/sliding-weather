# Development Guide

This guide centralizes local development, validation, and operational workflows.
For project overview, use [README.md](../README.md).
For architecture details, use [ARCHITECTURE.md](../ARCHITECTURE.md).

## Prerequisites

- Pebble SDK 3.x
- Bun (project scripts use Bun)
- OpenWeatherMap API key

## Local Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create local settings and add your API key:

   ```bash
   cp settings.local.json.template settings.local.json
   # Edit settings.local.json and replace the placeholder API key
   ```

## Build and Install

Compile TypeScript and build watch binaries:

```bash
bun run build
```

Manual two-step build:

```bash
bun run build:ts
pebble build
```

Install examples:

```bash
pebble install --emulator basalt
pebble install --phone <PHONE_IP>
```

## Emulator API Key Injection

Write API key values directly into emulator local storage:

```bash
bun run emu-settings
bun run emu-settings basalt
```

This writes into persistent Pebble emulator storage at:

- `~/.pebble-sdk/<sdk>/<platform>/localstorage/<uuid>`

Where:

- `<sdk>` is the active Pebble SDK version (for example `4.9.148`)
- `<platform>` is one target platform (`aplite`, `basalt`, `chalk`, `diorite`, `emery`, `flint`, or `gabbro`)
- `<uuid>` is the app UUID from `package.json` (`10c972fe-7002-42af-8ecb-2b9ab40ae589`)

Example:

- `~/.pebble-sdk/4.9.148/basalt/localstorage/10c972fe-7002-42af-8ecb-2b9ab40ae589`

The value persists between emulator sessions, so this is useful for testing
without opening a separate web configuration flow in a browser.

## Validation Workflow

Run these checks before finalizing changes:

```bash
bun test
bun run check
bun run typecheck
bun run build
```

## Multi-Platform Smoke Checks

Suggested emulator install matrix:

```bash
pebble install --emulator basalt
pebble install --emulator chalk
pebble install --emulator aplite
pebble install --emulator emery
```

## Debugging

- App install issues: verify emulator/device connectivity and retry install.
- Config not applying: inspect Clay payload handling in `src/pkjs/index.ts` and config parsing in `src/c/modules/config.c`.
- Weather issues: inspect request/parse logic in `src/pkjs/weather.ts`.

## Documentation Ownership

- Update `README.md` for user-facing behavior and setup changes.
- Update `ARCHITECTURE.md` for design, module, protocol, or platform behavior changes.
- Update this file for workflow, tooling, and verification process changes.

## AI Tooling Notes

Repository-level AI workflow and completion requirements are defined in:

- `.github/copilot-instructions.md`

If those instructions reference build/test/lint/install mechanics, this file is the operational companion and should be kept in sync.