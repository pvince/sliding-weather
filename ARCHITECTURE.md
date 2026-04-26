# Architecture and Design

This document contains implementation-level details for Sliding Weather.
For a quick project overview and setup, use [README.md](README.md).
For build/test/debug workflows, use [.github/DEVELOPMENT.md](.github/DEVELOPMENT.md).

## System Overview

Sliding Weather is split into two runtime layers:

- A C watchapp layer for UI, animations, persistence, and watch-side behavior.
- A PebbleKit JS layer for network requests, configuration page integration, and bridging settings/data via AppMessage.

Weather data is fetched through OpenWeatherMap and sent to the watch over AppMessage.

## Module Map

### C Watchapp Modules

| Component | Location | Responsibility |
|-----------|----------|----------------|
| App entry | `src/c/main.c` | App lifecycle, window setup, event wiring |
| Config | `src/c/modules/config.h/.c` | Persistent settings, inbox parsing, style helpers |
| Time display | `src/c/modules/time_display.h/.c` | Word generation, layered text layout, slide animations |
| Weather display | `src/c/modules/weather.h/.c` | Weather/date rendering, request timing, cache usage |
| Bluetooth indicator | `src/c/modules/bt_indicator.h/.c` | Disconnect indicator visibility and updates |

### PebbleKit JS Modules

| Component | Location | Responsibility |
|-----------|----------|----------------|
| JS entrypoint | `src/pkjs/index.ts` | Pebble event listeners, Clay bootstrapping, settings forwarding |
| Weather logic | `src/pkjs/weather.ts` | OpenWeatherMap request/parse/convert flow |
| Config storage | `src/pkjs/config.ts` | API key persistence and retrieval |
| Clay config schema | `src/pkjs/clay-config.ts` | Settings UI definition |
| Clay customization | `src/pkjs/custom-clay.ts` | API key prefill behavior and UI hooks |

## Data Flow

1. Watch requests weather (or JS sends initial ready state).
2. PKJS determines location mode (GPS or static location) and issues OpenWeatherMap request.
3. PKJS parses the response and computes weather fields.
4. PKJS sends AppMessage payload to C.
5. C updates layers and persists the latest weather/status for startup reuse.

Configuration flow:

1. User opens settings in the Pebble mobile app.
2. Clay renders config UI based on `src/pkjs/clay-config.ts`.
3. On close, settings are sanitized in PKJS, API key is stored phone-side, and non-secret settings are sent to C.

## Message Protocol

Message keys are defined in `package.json` under `pebble.messageKeys` and generated into C/JS build artifacts.

| Key | Direction | Description |
|-----|-----------|-------------|
| `JS_READY` | JS->C | Signals PKJS readiness so the watch can begin weather flow |
| `GET_WEATHER` | C->JS | Requests weather update processing in PKJS |
| `WEATHER_USE_GPS` | C->JS | Indicates GPS mode (1) or static location mode (0) |
| `WEATHER_LOCATION` | C->JS | Static location string when GPS is disabled |
| `TEMPERATURE` | JS->C | Current temperature value in Fahrenheit |
| `TEMPERATURE_IN_C` | JS->C | Current temperature value in Celsius |
| `CONDITIONS` | JS->C | Weather condition summary text |
| `CONDITION_CODE` | JS->C | OpenWeatherMap weather condition code |
| `BACKGROUND_COLOR` | JS->C | Background color configuration |
| `HR_COLOR` | JS->C | Hour text color configuration |
| `MIN_COLOR` | JS->C | Minute text color configuration |
| `WD_COLOR` | JS->C | Weather/date text color configuration |
| `WEATHER_FREQUENCY` | JS->C | Weather refresh interval configuration |
| `USE_CELSIUS` | JS->C | Temperature unit preference (1 = C, 0 = F) |
| `VIBBRATE_BT_STATUS` | JS->C | Bluetooth disconnect vibration preference |
| `DISPLAY_WEATHER` | JS->C | Weather display enable/disable preference |

## Removed Keys (Legacy)

Some older keys were removed from the active protocol and are intentionally not listed in `package.json` anymore:

- `DISPLAY_O_PREFIX`
- `DISPLAY_DATE`
- `SHAKE_FOR_LOHI`
- `HOURMINUTES_ALIGNMENT`
- `WEATHERDATE_READABILITY`

Tests in `test/pkjs/clay-config.test.ts` validate that removed keys do not reappear.

## Key Design Decisions

- OpenWeatherMap-only implementation (no fallback provider).
- User-supplied API key, stored on phone side and not forwarded to C.
- Time-only mode on aplite to satisfy memory constraints.
- PebbleKit JS network compatibility handling for nonstandard status behavior.
- Persistent weather/status cache on watch to avoid blank startup state.
- Modular C architecture (`config`, `time_display`, `weather`, `bt_indicator`) for maintainability.

## Platform Considerations

- `aplite`: black/white, tighter memory, time-only operation.
- `basalt`/`diorite`/`flint`: rectangular color-capable layouts.
- `chalk`: round layout and capability-gated UI settings.
- `emery`: large display variant.
- `gabbro`: high-resolution color target.

## Preview Assets

Phone selector assets are declared in `package.json` resources and stored in `resources/images`.

| Asset | Dimensions |
|-----------|-----------|
| `menu-icon.png` | 25x25 |
| `preview-aplite.png` | 144x168 |
| `preview-basalt.png` | 144x168 |
| `preview-chalk.png` | 180x180 |
| `preview-diorite.png` | 144x168 |
| `preview-emery.png` | 200x228 |
| `preview-flint.png` | 144x168 |
| `preview-gabbro.png` | 260x260 |

Refresh flow:

```bash
pebble screenshot --emulator <platform> --no-open resources/images/preview-<platform>.png
```

Keep filenames stable so resource identifiers and metadata remain consistent.