---
name: pebble-code-review
description: 'Full-stack code review for Pebble watchapps covering C watchapp, PebbleKit JS, and config page. Use when reviewing changes, auditing for regressions, checking preprocessor guards, verifying platform compatibility, or reviewing AppMessage plumbing between C and JS layers.'
argument-hint: 'Describe what to review: a specific file, a PR, the full codebase, or a particular concern (e.g. "platform guards", "AppMessage keys")'
---

# Pebble Watchapp Code Review

Full-stack review workflow for Pebble watchapps spanning C firmware, PebbleKit JS, and config page layers. Catches platform regressions, guard mismatches, and cross-layer communication bugs.

## When to Use

- After refactoring C code (especially extracting modules)
- When adding or changing platform support
- Before deploying to physical hardware
- When weather, date, or config features stop working on specific platforms
- After changing `package.json` messageKeys or adding new AppMessage keys

## Procedure

### Phase 1: Platform Preprocessor Guards (C Layer)

This is the highest-priority check. Guard mismatches cause silent feature loss on specific platforms.

1. **Identify the guard intent.** Pebble has two common guard patterns with very different semantics:

   | Guard | Meaning | Excludes |
   |-------|---------|----------|
   | `#if defined(PBL_COLOR)` | Color display capability | aplite, diorite (B&W platforms) |
   | `#if !defined(PBL_PLATFORM_APLITE)` | Non-aplite (any platform with enough memory) | Only aplite |
   | `#if defined(PBL_RECT)` | Rectangular display | chalk (round) |
   | `#if defined(PBL_ROUND)` | Round display | All rectangular platforms |
   | `PBL_IF_ROUND_ELSE(a, b)` | Inline round/rect value | N/A (compile-time ternary) |

2. **Match guards to feature intent, not display capability.** Weather, date, and config features are memory-gated, not color-gated. Use `!PBL_PLATFORM_APLITE` for features excluded due to aplite's 24KB RAM limit. Use `PBL_COLOR` only for code that literally requires color (e.g., `GColorFromHEX`).

3. **Audit all `#if` / `#ifdef` / `#ifndef` directives.** For each one, verify:
   - Does the guard match the original intent? (Check git history if unsure)
   - Are open/close `#endif` comments accurate? (e.g., `#endif // !PBL_PLATFORM_APLITE`)
   - Are matching guards consistent across `.h` and `.c` files?

4. **Cross-reference the platform defines.** Check `build/c4che/<platform>_cache.py` for the `DEFINES` list and `PLATFORM['MAX_APP_MEMORY_SIZE']` to see what each platform provides:

   | Platform | Color | Shape | Health | Mic | Display | RAM |
   |----------|-------|-------|--------|-----|---------|-----|
   | aplite | `PBL_BW` | `PBL_RECT` | — | — | 144×168 | 24 KB |
   | basalt | `PBL_COLOR` | `PBL_RECT` | ✓ | ✓ | 144×168 | 64 KB |
   | chalk | `PBL_COLOR` | `PBL_ROUND` | ✓ | ✓ | 180×180 | 64 KB |
   | diorite | `PBL_BW` | `PBL_RECT` | ✓ | ✓ | 144×168 | 64 KB |
   | emery | `PBL_COLOR` | `PBL_RECT` | ✓ | ✓ | 200×228 | 128 KB |
   | flint | `PBL_BW` | `PBL_RECT` | ✓ | ✓ | 144×168 | 64 KB |
   | gabbro | `PBL_COLOR` | `PBL_ROUND` | ✓ | ✓ | 260×260 | 128 KB |

> **Critical:** Diorite and flint are B&W but have 64KB RAM — they should get weather/date features. Using `PBL_COLOR` instead of `!PBL_PLATFORM_APLITE` silently disables these features on all B&W platforms except aplite.

### Phase 2: AppMessage Key Consistency

Message keys bridge the C and JS layers. A mismatch causes silent data loss.

1. **Check the single source of truth.** Keys are defined in `package.json` under `pebble.messageKeys`. The build generates:
   - `build/include/message_keys.auto.h` (C externs)
   - `build/src/message_keys.auto.c` (C definitions with numeric IDs)
   - `build/js/message_keys.json` (JS key→ID map)

2. **Verify C code references only declared keys.** Search for `MESSAGE_KEY_` in all `.c` files and confirm each one exists in `package.json`.

3. **Verify JS code uses the generated key map.** The JS layer should `require('../../build/js/message_keys.json')` and reference keys by name (e.g., `mk.TEMPERATURE`), not by numeric ID.

4. **Check key lookup on real hardware.** PebbleKit JS delivers payload keys as **numeric IDs** on the emulator but as **string names** on real Bluetooth hardware. Ensure the JS layer handles both:
   ```js
   // Must look up by numeric ID AND by string name
   function getPayload(payload, key) {
     if (payload[key] !== undefined) return payload[key];
     for (var name in mk) {
       if (mk[name] === key) return payload[name];
     }
     return undefined;
   }
   ```

### Phase 3: AppMessage Flow

1. **Verify JS_READY handshake.** The C side should not send outbox messages before JS signals readiness:
   - JS sends `JS_READY=1` on `ready` event
   - C receives it in inbox handler and sets a flag
   - Weather requests only fire after `s_js_ready == true`

2. **Check deferred sends.** Never call `app_message_outbox_begin` from inside `inbox_received` — it silently drops on real Bluetooth hardware. Use `app_timer_register(200, callback, NULL)` to defer.

3. **Verify retry logic.** If `outbox_begin` or `outbox_send` returns non-OK, schedule a short retry (e.g., 5 seconds) instead of silently failing.

4. **Check inbox size.** Calling `app_message_inbox_size_maximum()` consumes ~8KB heap. Verify the platform has enough RAM (aplite: 24KB total, others: 64KB+).

### Phase 4: Layout and Display

1. **Verify layer creation matches platform guards.** If weather/date layers are only created inside a guard, the layout math for time layers must account for their absence in the `#else` branch.

2. **Check unobstructed area handling.** Timeline quick-view can shrink the visible area. Verify `layer_get_unobstructed_bounds()` is used instead of `layer_get_bounds()` where layout depends on available height.

3. **Verify round vs rect layout.** Check that `PBL_IF_ROUND_ELSE()` is used for padding, margins, and Y-offsets that differ between chalk and rectangular platforms.

4. **Font sizing for long words.** Time words like "seventeen" need full screen width. Verify long-word detection adjusts `origin.x` and `size.w` appropriately.

### Phase 5: Config Page and Persistence

1. **Verify config round-trip.** Config values flow: Config HTML → JS `webviewclosed` → `parseConfigResponse()` → `buildAppMessage()` → C `inbox_received` → `persist_write_*`.

2. **Check color parsing.** Config page sends ARGB hex strings (8 chars, e.g., `"ff00ff00"`). The parser must strip the alpha channel before `parseInt`:
   ```js
   if (s.length === 8) s = s.slice(2); // Strip alpha prefix
   ```

3. **Verify persistence keys.** C-side `persist_write_*` and `persist_read_*` should use `MESSAGE_KEY_*` constants as storage keys for consistency.

4. **Check `localStorage` vs `persist_*` separation.** The API key lives in JS `localStorage` (never sent to C). Weather data and display config use C `persist_*` storage.

### Phase 6: Memory Budget

1. **Check heap usage per platform.** After a build, the build output reports memory usage. Verify each platform stays within its RAM budget:
   - aplite: 24 KB total — only ~19 KB free after system overhead
   - basalt/chalk/diorite/flint: 64 KB total
   - emery/gabbro: 128 KB total

2. **Watch for `app_message_open` heap cost.** Using `app_message_inbox_size_maximum()` and `app_message_outbox_size_maximum()` consumes ~16 KB of heap (8 KB each). This is fine on 64 KB+ platforms but uses most of aplite's heap.

3. **Count text layers and buffers.** Each `TextLayer` and its backing `char[]` buffer consumes heap. Weather, date, and time layers with their buffers add up. Verify totals against the memory usage report.

4. **Check the build output memory report.** Look for lines like:
   ```
   APLITE APP MEMORY USAGE
   Total footprint in RAM:         4820 bytes / 24.0KB
   Free RAM available (heap):      19756 bytes
   ```
   If free heap is under 4 KB after AppMessage buffers, the app may crash on that platform.

### Phase 7: Animation Lifecycle

1. **Verify animations are cleaned up.** Every `property_animation_create_*` must be matched by a destroy path. Check that `prv_window_unload` or an equivalent cleanup function:
   - Calls `animation_unschedule()` on running animations
   - Calls `property_animation_destroy()` after unschedule
   - Nulls the animation pointer to prevent double-free

2. **Check the stopped handler.** The `AnimationHandlers.stopped` callback should null the animation pointer so in-flight callbacks don't reference freed memory.

3. **Guard against re-animation.** If a new animation starts while one is running on the same layer, the old animation must be unscheduled and destroyed first. Verify the pattern:
   ```c
   if (s_anim[idx]) {
     PropertyAnimation *old = s_anim[idx];
     s_anim[idx] = NULL;  // clear before unschedule triggers stopped handler
     animation_unschedule(property_animation_get_animation(old));
     property_animation_destroy(old);
   }
   ```

4. **Verify animation durations are reasonable.** Animations over 1000 ms on a 1-minute tick interval risk overlapping with the next tick's animation.

### Phase 8: Build Verification

1. **Build for all platforms.** Run `pebble build` and check for warnings beyond linker `LOAD segment` noise.

2. **Test on representative emulators.** At minimum:
   - `pebble install --emulator basalt` (color rectangular, 64 KB)
   - `pebble install --emulator diorite` (B&W rectangular, Pebble 2 HR, 64 KB)
   - `pebble install --emulator chalk` (color round, 64 KB)
   - `pebble install --emulator emery` (color rectangular, large display, 128 KB) — if layout scales

3. **Screenshot each emulator.** Use `pebble screenshot --emulator <platform>` and visually confirm weather, date, and time are all visible.

4. **Check logs for silent errors.** Run `pebble logs --emulator <platform>` and look for:
   - `Outbox begin failed` / `Outbox send failed`
   - `AppMessage inbox dropped`
   - Missing `JS_READY sent` log
   - Missing `Weather data sent to watchface` log

5. **Run JS tests.** Execute `npm test` to verify PebbleKit JS logic (config parsing, weather response handling, key mapping).

## Completion Criteria

- [ ] All preprocessor guards match their feature intent (not display capability)
- [ ] Guards are consistent across `.h` and `.c` file pairs
- [ ] All MESSAGE_KEY references exist in `package.json`
- [ ] JS handles both numeric and string key lookups
- [ ] JS_READY handshake is present and deferred sends are used
- [ ] Layout accounts for all platform shapes and guard branches
- [ ] Config round-trip tested (HTML → JS → C → persist)
- [ ] Builds cleanly for all target platforms
- [ ] Visually verified on basalt, diorite, and chalk emulators
- [ ] JS tests pass
