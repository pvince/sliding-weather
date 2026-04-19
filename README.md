# Sliding Weather

A Pebble watchface with sliding digit time animation and OpenWeatherMap weather display.

## Features

- **Sliding time animation** — each word slides in from the right on every minute tick; single-digit minutes display directly (e.g. "eleven / three" for 11:03) without a separate "o" prefix line
- **Adaptive font sizing** — long teen words (thirteen, fourteen, seventeen, eighteen, nineteen) automatically switch to a smaller font so they display fully without clipping
- **Live weather** — current temperature + conditions, with optional daily hi/lo on wrist shake
- **Weather status feedback** — clear on-screen messages for error states: "No API Key", "Invalid API Key", "Loading...", "Network Error", "No Location", "API Rate Limit"
- **Configurable** — colors, temperature unit (F/C), weather update frequency, GPS or static location, date display, font sizes, alignment, Bluetooth vibration
- **All platforms** — aplite, basalt, chalk, diorite, emery, flint, gabbro (7 platforms)
- **Aplite time-only** — original Pebble (aplite) displays time only; weather excluded to fit within memory constraints
- **Round watch layout** — Chalk (Pebble Time Round) gets a dedicated round-optimized config page

## Requirements

- A free [OpenWeatherMap API key](https://openweathermap.org/api) — you must supply your own; no default key is bundled
- Pebble SDK 3.x

## Setup

1. Clone this repo
2. Build with `pebble build`
3. Install on your watch: `pebble install --emulator basalt` (or a physical device)
4. Open the watchface settings from the Pebble app on your phone
5. Paste your OpenWeatherMap API key
6. Configure colors, location, and other preferences

## Config Page (GitHub Pages)

The configuration UI is hosted via GitHub Pages in the `docs/` folder:

- Rectangular watches: `https://pvince.github.io/sliding-weather/`
- Round watches (Chalk): `https://pvince.github.io/sliding-weather/config_round.html`

To enable, go to your repository **Settings → Pages** and set the source to the `docs/` folder on `main`.

## Development

### Build

```bash
pebble build
```

### Run tests

```bash
npm install
npm test
```

Tests cover JS weather logic (temperature conversion, OWM response parsing, URL construction), config parsing/serialization, and config page form behavior. C watchface code is verified via emulator testing.

### Emulator verification

```bash
pebble install --emulator basalt    # standard rectangular + color
pebble install --emulator chalk     # round display
pebble install --emulator aplite    # time-only, B&W
pebble install --emulator emery     # large display (200×228)
```

## Architecture

| Component | Location | Description |
|-----------|----------|-------------|
| C watchface | `src/c/sliding-weather.c` | Sliding digit animation, weather/date display, config persistence via `persist_*`, AppMessage handler |
| PebbleKit JS entry | `src/pkjs/index.js` | Pebble event listeners (`ready`, `appmessage`, `showConfiguration`, `webviewclosed`) |
| Weather logic | `src/pkjs/weather.js` | OWM API requests, response parsing, Kelvin→F/C conversions |
| Config logic | `src/pkjs/config.js` | Config JSON parsing, AppMessage building, localStorage helpers |
| Rectangular config page | `docs/index.html` | Settings UI for square/rectangular watches |
| Round config page | `docs/config_round.html` | Settings UI for Chalk (round); alignment fixed to center |

## Design Decisions

- **OpenWeatherMap only** — Yahoo Weather removed (deprecated since 2019); no hardcoded fallback key
- **User-supplied API key** — stored only in phone localStorage; never sent to the C watchapp
- **Aplite time-only** — weather excluded via `#ifndef PBL_PLATFORM_APLITE` to meet memory constraints
- **PebbleKit JS XHR compatibility** — HTTP status checks guarded by `xhr.status >= 100` because PebbleKit JS proxies XHR through the phone app and may report status `0` for successful requests
- **Weather persistence** — weather data and status messages are cached on the watch via `persist_*` so the last known state is shown immediately on startup instead of "Loading..." while waiting for the phone's Bluetooth connection and JS layer
- **Sliding animation** — each digit is a separate `Layer` with a custom `update_proc` that clips two text characters at offset positions; driven by a single `AnimationImplementation` updating scroll offsets each frame
- **`configurable` capability** — declared in `appinfo.json` and `package.json`; required for the Pebble mobile app to display the settings gear icon next to the watchface, which triggers the `showConfiguration` PebbleKit JS event
- **Config page via GitHub Pages** — `docs/` folder served as a static site; rectangular and round variants share all fields but the round page omits alignment selects (always centered)
- **Config page ↔ JS communication** — settings passed back to JS via `pebblejs://close#<encoded_json>`; config URL populated with current settings in URL hash for round-trip editing
- **Weather fonts** — `FONT_KEY_LECO_42_NUMBERS` on color platforms; `FONT_KEY_BITHAM_42_BOLD` on B&W platforms
- **Shake for hi/lo** — wrist tap toggles between current temperature and daily hi/lo; requires accelerometer tap service (non-aplite only)

## Message Keys

All keys defined in `package.json → pebble.messageKeys`. Generated as `MESSAGE_KEY_*` constants in C and a numeric map in `build/js/message_keys.json`.

| Key | Direction | Description |
|-----|-----------|-------------|
| `JS_READY` | JS→C | Signals JS is ready; C sends first weather request |
| `GET_WEATHER` | C→JS | Requests a weather update; carries GPS flag and location |
| `WEATHER_USE_GPS` | C→JS | 1 = use GPS, 0 = use static location |
| `WEATHER_LOCATION` | C→JS | Static location string (city name) |
| `TEMPERATURE` | JS→C | Current temperature in Fahrenheit |
| `TEMPERATURE_IN_C` | JS→C | Current temperature in Celsius |
| `CONDITIONS` | JS→C | Weather condition string (e.g. "Clouds") |
| `TEMPERATURE_LO/HI` | JS→C | Daily lo/hi in Fahrenheit |
| `TEMPERATURE_IN_C_LO/HI` | JS→C | Daily lo/hi in Celsius |
| `CONDITION_CODE` | JS→C | OWM weather condition code |
| `BACKGROUND_COLOR` | JS→C | Background color (hex int) |
| `HR_COLOR` | JS→C | Hour digit color (hex int) |
| `MIN_COLOR` | JS→C | Minute digit color (hex int) |
| `WD_COLOR` | JS→C | Weather/date text color (hex int) |
| `WEATHER_FREQUENCY` | JS→C | Update interval in minutes |
| `USE_CELSIUS` | JS→C | 1 = Celsius, 0 = Fahrenheit |
| `DISPLAY_O_PREFIX` | JS→C | 1 = show degree symbol (°) |
| `DISPLAY_DATE` | JS→C | 1 = show date row |
| `SHAKE_FOR_LOHI` | JS→C | 1 = enable shake to toggle hi/lo |
| `VIBBRATE_BT_STATUS` | JS→C | 1 = vibrate on Bluetooth disconnect |
| `WEATHERDATE_ALIGNMENT` | JS→C | 0=center, 1=left, 2=right |
| `HOURMINUTES_ALIGNMENT` | JS→C | 0=center, 1=left, 2=right |
| `WEATHERDATE_READABILITY` | JS→C | 0=small, 1=small bold, 2=large, 3=large bold |
