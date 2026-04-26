# Sliding Weather

Sliding Weather is a Pebble watchface with animated word-based time and OpenWeatherMap weather data.

## Features

- Sliding time animation that updates every minute
- Live weather with clear status messaging for errors
- Day and date display with ordinal suffixes
- Customizable colors, weather units, update frequency, location mode, and Bluetooth vibration
- Support for all Pebble SDK 3.x target platforms
- Time-only mode on aplite for memory-constrained hardware
- Phone app menu icon and platform-specific preview screenshots

## Requirements

- Pebble SDK 3.x
- A free OpenWeatherMap API key: https://openweathermap.org/api

## Quick Start

1. Clone the repository.
2. Create local settings and add your API key:

   ```bash
   cp settings.local.json.template settings.local.json
   # Edit settings.local.json and replace the placeholder key
   ```

3. Build the project:

   ```bash
   bun run build
   ```

4. Install to an emulator or a device:

   ```bash
   pebble install --emulator basalt
   # or
   pebble install --phone <PHONE_IP>
   ```

5. Open watchface settings in the Pebble mobile app and configure preferences.
6. Optional validation checks:

   ```bash
   bun test
   bun run check
   ```

   For the full validation and debugging workflow, see [.github/DEVELOPMENT.md](.github/DEVELOPMENT.md).

> `settings.local.json` is gitignored and should never be committed.

## Configuration

Configuration is powered by Clay and generated from TypeScript config definitions in `src/pkjs/clay-config.ts`.

- API key storage is phone-side only.
- The API key is removed from config payloads before settings are sent to the watch.

For detailed config behavior and message flow, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Documentation Map

- Project design and internals: [ARCHITECTURE.md](ARCHITECTURE.md)
- Build, test, lint, emulator, and debugging workflows: [.github/DEVELOPMENT.md](.github/DEVELOPMENT.md)
- AI workflow policy and repository automation constraints: [.github/copilot-instructions.md](.github/copilot-instructions.md)

## Supported Platforms

The watchface targets all supported Pebble SDK 3.x platforms:

- aplite
- basalt
- chalk
- diorite
- emery
- flint
- gabbro
