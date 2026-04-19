# Bug: Weather stuck on "Loading..." on Pebble 2 HR (real hardware)

## Status
**Resolved** — Fixed in commit 3594b82

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

## Root Cause (Actual)

Two independent issues prevented weather from loading on real hardware:

### 1. Bluetooth Outbox Race Condition
**Problem:** Calling `app_message_outbox_send()` from inside the `inbox_received` handler silently dropped the message on real Bluetooth hardware. The race occurred because:
- The inbox handler is called when a message arrives (JS_READY)
- Inside that handler, the code immediately tried to send a weather request
- The Bluetooth stack was still processing the incoming message, so the outbox send was lost
- No error was logged — it silently failed

**How it was diagnosed:**
- Added `APP_LOG()` at the C watchface level: confirmed `JS_READY received` and `Weather request sent` logs appeared
- Added `console.log()` at the JS level: confirmed the `appmessage` handler was **never** called
- This proved the weather request message never reached JS
- The emulator worked because it uses in-process communication, not Bluetooth, avoiding the race

**Resolution:** Defer the weather request using `app_timer_register(200, prv_deferred_request_weather, NULL)` so the inbox handler completes first before attempting to send. Also replaced the 30-minute retry timer on outbox busy with a 5-second retry.

### 2. Payload Key Format Mismatch
**Problem:** PebbleKit JS delivers AppMessage payload keys differently on real hardware vs. the emulator:
- **Emulator:** numeric keys (`payload[10011]` for GET_WEATHER)
- **Real hardware:** string keys (`payload["GET_WEATHER"]`)

The JS handler code only checked numeric keys, so on real hardware `payload[mk.GET_WEATHER]` (where `mk.GET_WEATHER = 10011`) was always `undefined`. The handler exited immediately with `if (!payload[mk.GET_WEATHER]) return;` before calling `getWeather()`.

**How it was diagnosed:**
- Captured logs showing the appmessage payload: `{"GET_WEATHER":1,"WEATHER_USE_GPS":0,"WEATHER_LOCATION":"Cincinnati, Ohio"}`
- Keys were strings, not numbers
- Matched against `message_keys.json`: `GET_WEATHER = 10011`, but payload had `"GET_WEATHER"` as a string
- The mismatch explained why JS never called the weather API

**Resolution:** Added `getPayload()` helper function that looks up payload values by either numeric key or string name:
```javascript
function getPayload(payload, key) {
  if (payload[key] !== undefined) return payload[key];
  for (var name in mk) {
    if (mk[name] === key) return payload[name];
  }
  return undefined;
}
```

---

## How the Issue Was Diagnosed

1. **Reviewed hardware logs** using `pebble logs --phone 192.168.1.93` with the watch running
2. **Verified JS startup:** Confirmed `PebbleKit JS ready` and `JS_READY sent` messages appeared
3. **Added diagnostic logging** at the C level to track the weather request flow
4. **Discovered message loss:** C logs showed `Weather request sent`, but JS never logged `appmessage received`
5. **Added JS-side logging** to the payload: `console.log('appmessage received: ' + JSON.stringify(payload))`
6. **Started a log listener first**, then installed a fresh build to capture the complete startup sequence
7. **Identified root cause #1:** Message was lost in the Bluetooth race between inbox handler and outbox send
8. **Implemented deferral** with `app_timer_register()` to break the race
9. **Rebuilt and re-tested** — now JS received the appmessage but still didn't process it
10. **Examined the payload format** in the logs: strings instead of numbers
11. **Identified root cause #2:** Key format mismatch between platforms
12. **Implemented `getPayload()` helper** to handle both formats
13. **Final test:** Weather now fetches and displays "No API Key" as expected

---

## Current Behaviour After Resolution

| Scenario | Before | After |
|---|---|---|
| First launch (no API key) | "Loading..." forever | "No API Key" displayed |
| Subsequent launches | "Loading..." indefinitely | Instant cached weather state |
| Emulator (basalt) | "Loading..." (emulator only worked before later fix) | Correct state displayed |
| Real hardware (diorite) | "Loading..." stuck | Correct state displayed |
| With valid API key | "Loading..." forever | Current conditions displayed |
| Network error | "Loading..." forever | "Network Error" displayed |

---

## Changes Made

- **`src/c/sliding-weather.c`:**
  - Added `prv_deferred_request_weather()` callback
  - Added `prv_schedule_weather_retry()` for 5-second retry on busy outbox
  - Modified `prv_inbox_received_handler()` to defer weather request with timer
  - Modified `prv_request_weather()` to use `prv_schedule_weather_retry()` instead of full 30-minute timer on failure

- **`src/pkjs/index.js`:**
  - Added `getPayload()` helper to look up keys by both numeric ID and string name
  - Updated appmessage handler to use `getPayload()` for all payload accesses

- **`test/pkjs/index.test.js`:**
  - Added tests for string-keyed payloads to verify real hardware format works

---

## Outstanding Questions

The issue is now fully resolved. All suggested debugging steps proved unnecessary once the two root causes were identified and fixed.

---

## Relevant Files

| File | Changes |
|---|---|
| `src/c/sliding-weather.c` | Deferred weather request, short retry on outbox busy |
| `src/pkjs/index.js` | Added `getPayload()` helper for key format compatibility |
| `src/pkjs/weather.js` | Earlier fix: HTTP status guard for PebbleKit JS |
| `src/c/sliding-weather.c` | Earlier fix: Weather data persistence with `persist_*` |
| `test/pkjs/index.test.js` | Added test coverage for string-keyed payloads |

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
