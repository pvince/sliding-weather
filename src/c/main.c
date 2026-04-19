#include <pebble.h>

#include "modules/config.h"
#include "modules/time_display.h"
#if !defined(PBL_PLATFORM_APLITE)
#include "modules/weather.h"
#endif

// ============================================================
// Globals
// ============================================================

static Window *s_window;

// ============================================================
// Bluetooth handler
// ============================================================

static void prv_bt_handler(bool connected) {
  if (!connected && config_get_vibbrate_bt()) {
    vibes_double_pulse();
  }
}

// ============================================================
// Tick handler
// ============================================================

static void prv_tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  (void)units_changed;
  time_display_set_time(tick_time);

#if !defined(PBL_PLATFORM_APLITE)
  weather_update_date(tick_time);
#endif
}

// ============================================================
// AppMessage handlers
// ============================================================

static void prv_inbox_received_handler(DictionaryIterator *iter, void *context) {
  (void)context;

  // ----- JS Ready (non-aplite only) -----
#if !defined(PBL_PLATFORM_APLITE)
  Tuple *js_ready_t = dict_find(iter, MESSAGE_KEY_JS_READY);
  if (js_ready_t && js_ready_t->value->int32 == 1) {
    weather_on_js_ready();
    return;
  }

  // ----- Weather data -----
  weather_handle_inbox(iter);
#endif

  // ----- Config -----
  bool config_changed = config_handle_inbox(iter);
  if (config_changed) {
    window_set_background_color(s_window, config_get_bg_color());
    time_display_apply_config();
#if !defined(PBL_PLATFORM_APLITE)
    weather_apply_config();
#endif
  }
}

static void prv_inbox_dropped_handler(AppMessageResult reason, void *context) {
  (void)context;
  APP_LOG(APP_LOG_LEVEL_WARNING, "AppMessage inbox dropped: %d", (int)reason);
}

static void prv_outbox_failed_handler(DictionaryIterator *iter, AppMessageResult reason,
                                      void *context) {
  (void)iter; (void)context;
  APP_LOG(APP_LOG_LEVEL_ERROR, "AppMessage outbox failed: %d", (int)reason);
}

// ============================================================
// Unobstructed area handler
// ============================================================

static void __attribute__((unused)) prv_unobstructed_did_change(void *context) {
  (void)context;
  Layer *root = window_get_root_layer(s_window);
  GRect bounds = layer_get_unobstructed_bounds(root);
  int16_t h = bounds.size.h;
  int16_t padding = PBL_IF_ROUND_ELSE(20, 4);

  int16_t time_block_h = NUM_TIME_LINES * LINE_H + (NUM_TIME_LINES - 1) * LINE_GAP;

#if !defined(PBL_PLATFORM_APLITE)
  int16_t weather_y = PBL_IF_ROUND_ELSE(10, 2);
  int16_t row_h = 22;
  int16_t date_y = h - row_h - PBL_IF_ROUND_ELSE(10, 2);
  int16_t time_top = weather_y + row_h;
  int16_t time_bottom = date_y;
  int16_t time_start_y = time_top + (time_bottom - time_top - time_block_h) / 2;

  weather_relayout(weather_y, date_y, padding);
#else
  int16_t time_start_y = (h - time_block_h) / 2;
#endif

  time_display_relayout(time_start_y, padding);
}

// ============================================================
// Window lifecycle
// ============================================================

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_unobstructed_bounds(root);
  int16_t h = bounds.size.h;
  int16_t padding = PBL_IF_ROUND_ELSE(20, 4);

  int16_t time_block_h = NUM_TIME_LINES * LINE_H + (NUM_TIME_LINES - 1) * LINE_GAP;

#if !defined(PBL_PLATFORM_APLITE)
  // Weather at top
  int16_t weather_y = PBL_IF_ROUND_ELSE(10, 2);
  int16_t row_h = 22;
  // Date at bottom
  int16_t date_y = h - row_h - PBL_IF_ROUND_ELSE(10, 2);
  // Time words centered between weather bottom and date top
  int16_t time_top = weather_y + row_h;
  int16_t time_bottom = date_y;
  int16_t time_start_y = time_top + (time_bottom - time_top - time_block_h) / 2;

  weather_create(window, weather_y, date_y, padding);
#else
  int16_t time_start_y = (h - time_block_h) / 2;
#endif

  time_display_create(window, time_start_y, padding);

  // Snap to current time WITHOUT animation on initial load
  time_t now = time(NULL);
  struct tm *tick_time = localtime(&now);
  time_display_snap_to_time(tick_time);

#if !defined(PBL_PLATFORM_APLITE)
  weather_load_persisted();
  weather_update_date(tick_time);
  weather_apply_config();
#endif
}

static void prv_window_unload(Window *window) {
  (void)window;
  time_display_destroy();

#if !defined(PBL_PLATFORM_APLITE)
  weather_destroy();
#endif
}

// ============================================================
// Init / Deinit
// ============================================================

static void prv_init(void) {
  config_init();

  s_window = window_create();
  window_set_background_color(s_window, config_get_bg_color());
  window_set_window_handlers(s_window, (WindowHandlers){
    .load   = prv_window_load,
    .unload = prv_window_unload,
  });

  app_message_register_inbox_received(prv_inbox_received_handler);
  app_message_register_inbox_dropped(prv_inbox_dropped_handler);
  app_message_register_outbox_failed(prv_outbox_failed_handler);
  app_message_open(app_message_inbox_size_maximum(),
                   app_message_outbox_size_maximum());

  tick_timer_service_subscribe(MINUTE_UNIT, prv_tick_handler);
  bluetooth_connection_service_subscribe(prv_bt_handler);

#if !defined(PBL_PLATFORM_APLITE)
  accel_tap_service_subscribe(weather_tap_handler);
#endif

  unobstructed_area_service_subscribe((UnobstructedAreaHandlers){
    .did_change = prv_unobstructed_did_change,
  }, NULL);

  window_stack_push(s_window, true);
}

static void prv_deinit(void) {
  tick_timer_service_unsubscribe();
  bluetooth_connection_service_unsubscribe();
  unobstructed_area_service_unsubscribe();

#if !defined(PBL_PLATFORM_APLITE)
  accel_tap_service_unsubscribe();
#endif

  window_destroy(s_window);
}

// ============================================================
// Entry point
// ============================================================

int main(void) {
  prv_init();
  app_event_loop();
  prv_deinit();
  return 0;
}
