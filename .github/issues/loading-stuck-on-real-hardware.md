# Bug: Weather stuck on "Loading..." on Pebble 2 HR (real hardware)

## Status
**Open** — partially mitigated but not fully resolved.

## Environment
- Device: **Pebble 2 HR** (physical hardware)
- Platform: `diorite`
- Emulator: `basalt` — **works correctly** (shows "No API Key" as expected)

## Symptom
The weather row on the watchface is permanently stuck on "Loading..." on real hardware even after:
- Uninstalling the watchface
- `pebble clean && pebble build`
- Copying fresh `.pbw` to phone and reinstalling

The emulator works correctly — it shows "No API Key" when no API key is configured — so the JS code itself is functioning.

---

## Root Cause Investigation

### What was ruled out

**Hypothesis 1: JS bundle out of date**
Checked `build/pebble-js-app.js` — it contains the latest code (`No API Key`, error-first callbacks, `xhr.status >= 100` guard). The bundle is current.

**Hypothesis 2: C code not handling status messages**
The inbox handler at `prv_inbox_received_handler()` correctly handles a `CONDITIONS`-only message (no `TEMPERATURE`) as a status/error message. Verified against the source.

### What was already fixed (prior work in this session)

1. **`xhr.status` blocking all responses** (`src/pkjs/weather.js`)
   - PebbleKit JS proxies XHR through the phone app. `xhr.status` is often `0` for successful responses.
   - The original error-status check (`if (xhr.status < 200 || xhr.status >= 300)`) caught `0 < 200 = true`, meaning **every successful response was rejected as an error**.
   - Fixed by wrapping status checks in `if (xhr.status >= 100)`.
   - This fixed "Loading..." on the **emulator** but did not resolve the real hardware issue.

2. **Weather data not persisted across launches** (`src/c/sliding-weather.c`)
   - On real hardware the phone's PebbleKit JS layer takes time to connect over Bluetooth. "Loading..." was shown until JS was ready, which could be indefinitely if the Pebble app wasn't foregrounded.
   - Added `prv_load_weather()` which restores cached weather/status from `persist_*` storage on init.
   - Added `persist_write_*` calls whenever weather data or status messages are received.
   - Removed a `s_weather_valid = false` initializer in `prv_init()` that would have overwritten the loaded cache.
   - This ensures the **last known state** (temperature, conditions, or error message) is shown instantly on every subsequent launch.
   - **However**, this only helps after the first successful data exchange. It does not fix "Loading..." on first install or when JS never successfully responds.

---

## Current Behaviour After Fixes

| Scenario | Before | After |
|---|---|---|
| First launch ever | "Loading..." forever | "Loading..." until JS connects |
| Subsequent launches | "Loading..." until JS connects | Instant cached state |
| Emulator (basalt) | "Loading..." forever | "No API Key" correctly |
| Real hardware (diorite) | "Loading..." forever | Still "Loading..." (JS not responding?) |

---

## Outstanding Questions

The core question is: **why does JS never send a response to the watch on real hardware?**

Possible remaining causes (not yet investigated):

1. **`JS_READY` message never received / dropped**
   - The watch only calls `prv_request_weather()` when `s_js_ready = true`, which is set when the C code receives `MESSAGE_KEY_JS_READY = 1` from JS.
   - If the `JS_READY` AppMessage is dropped (e.g., inbox not yet open when JS sends it, or message too large for buffer), the watch never requests weather.
   - The watch calls `app_message_open(app_message_inbox_size_maximum(), app_message_outbox_size_maximum())` — this should be fine, but worth verifying the actual buffer sizes on `diorite`.

2. **AppMessage buffer overflow dropping the weather reply**
   - The `CONDITIONS` string (up to 32 bytes) plus multiple `int32` temperature values is a reasonably-sized message. Could be dropped if the inbox is busy or too small.
   - Check if `prv_inbox_dropped_handler` is firing: it logs `APP_LOG_LEVEL_WARNING, "AppMessage inbox dropped: %d"`.

3. **Platform-specific JS issue on `diorite`**
   - The `diorite` (Pebble 2 HR) platform runs a different firmware/runtime than `basalt`. PebbleKit JS behaviour may differ.
   - Worth checking if `pebble logs` on the real device shows the JS `console.log` messages (e.g., `"PebbleKit JS ready"`, `"No OWM API key configured"`, `"Weather status sent to watchface: No API Key"`).

4. **`getApiKey()` returning unexpected value on real hardware**
   - The API key is read from `localStorage.getItem('sliding_weather_owm_api_key')`.
   - If `localStorage` is unavailable or throws, `getApiKey()` returns `''` which triggers `onComplete({ message: 'No API Key' })` and a send attempt. The send could fail.

5. **`Pebble.sendAppMessage` callback never firing**
   - On real hardware with poor Bluetooth connectivity, the AppMessage send may silently time out without triggering the success or error callback.

---

## Suggested Next Debugging Steps

### 1. Enable app logging on real hardware
```bash
pebble install --phone <phone-ip>  # install while phone connected
pebble logs --phone <phone-ip>
```
Look for:
- `PebbleKit JS ready` — confirms JS started
- `No OWM API key configured` — confirms `getApiKey()` returned empty
- `Weather status sent to watchface: No API Key` — confirms send was attempted
- `AppMessage inbox dropped: N` — would indicate dropped messages
- Absence of the above — JS never ran

### 2. Add a watchface-side fallback timer
If `JS_READY` is never received within N seconds, request weather anyway (in case the message was dropped). Currently the watch is entirely dependent on receiving `JS_READY`.

```c
// In prv_init(), after app_message_open():
// Schedule a fallback: if JS_READY hasn't arrived in 10s, try requesting weather
app_timer_register(10000, prv_js_ready_fallback_callback, NULL);

static void prv_js_ready_fallback_callback(void *data) {
  if (!s_js_ready) {
    APP_LOG(APP_LOG_LEVEL_INFO, "JS_READY not received, trying weather request anyway");
    prv_request_weather();
  }
}
```

### 3. Check if `diorite` has a different AppMessage inbox size
`diorite` has 64KB RAM total. `app_message_inbox_size_maximum()` may return a smaller value than `basalt`. Add a log to verify:
```c
APP_LOG(APP_LOG_LEVEL_INFO, "AppMessage inbox size: %u", (unsigned)app_message_inbox_size_maximum());
```

---

## Relevant Files

| File | Relevance |
|---|---|
| `src/c/sliding-weather.c` | `prv_inbox_received_handler`, `prv_request_weather`, `prv_load_weather`, `prv_init` |
| `src/pkjs/weather.js` | `getWeather`, `httpGet` — error-first callback, `xhr.status` guard |
| `src/pkjs/index.js` | `appmessage` handler — sends `CONDITIONS`-only on error |
| `src/pkjs/config.js` | `getApiKey` — reads from `localStorage` |
| `build/pebble-js-app.js` | Webpack bundle — what actually runs on phone |

## Key Constants
- `MESSAGE_KEY_JS_READY` = 10024
- `MESSAGE_KEY_GET_WEATHER` = 10011
- `MESSAGE_KEY_CONDITIONS` = 10001
- `MESSAGE_KEY_TEMPERATURE` = 10012
- `MESSAGE_KEY_DISPLAY_WEATHER` = 10007 (used as persist key for `s_weather_valid`)
