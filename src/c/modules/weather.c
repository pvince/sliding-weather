#include "weather.h"
#include "config.h"

#if !defined(PBL_PLATFORM_APLITE)

#define CONDITIONS_MAXLEN      32
#define WEATHER_TEXT_MAXLEN    48
#define DATE_TEXT_MAXLEN       24

// Degree symbol (UTF-8)
#define DEGREE_SYMBOL "\xc2\xb0"

// ============================================================
// Module state
// ============================================================

static Window     *s_window;
static TextLayer  *s_weather_layer;
static TextLayer  *s_date_layer;
static int         s_temp_f;
static int         s_temp_c;
static int         s_temp_lo_f;
static int         s_temp_hi_f;
static int         s_temp_lo_c;
static int         s_temp_hi_c;
static char        s_conditions[CONDITIONS_MAXLEN];
static char        s_weather_text[WEATHER_TEXT_MAXLEN];
static char        s_date_text[DATE_TEXT_MAXLEN];
static bool        s_show_lohi;
static bool        s_weather_valid;
static bool        s_js_ready;
static AppTimer   *s_weather_timer;

// ============================================================
// Weather display
// ============================================================

static void prv_update_weather_display(void) {
  if (!s_weather_valid) {
    if (s_conditions[0] != '\0') {
      text_layer_set_text(s_weather_layer, s_conditions);
    } else {
      text_layer_set_text(s_weather_layer, "Loading...");
    }
    return;
  }

  if (s_show_lohi && config_get_shake_for_lohi()) {
    int lo = config_get_use_celsius() ? s_temp_lo_c : s_temp_lo_f;
    int hi = config_get_use_celsius() ? s_temp_hi_c : s_temp_hi_f;
    if (config_get_display_o_prefix()) {
      snprintf(s_weather_text, sizeof(s_weather_text),
               "H:%d" DEGREE_SYMBOL " L:%d" DEGREE_SYMBOL, hi, lo);
    } else {
      snprintf(s_weather_text, sizeof(s_weather_text), "H:%d L:%d", hi, lo);
    }
  } else {
    int temp = config_get_use_celsius() ? s_temp_c : s_temp_f;
    if (config_get_display_o_prefix()) {
      snprintf(s_weather_text, sizeof(s_weather_text),
               "%d" DEGREE_SYMBOL " %s", temp, s_conditions);
    } else {
      snprintf(s_weather_text, sizeof(s_weather_text), "%d %s", temp, s_conditions);
    }
  }

  text_layer_set_text(s_weather_layer, s_weather_text);
}

// ============================================================
// Weather request
// ============================================================

static void prv_request_weather(void);

static void prv_weather_timer_callback(void *data) {
  (void)data;
  s_weather_timer = NULL;
  if (s_js_ready) {
    prv_request_weather();
  }
}

static void prv_schedule_weather_timer(void) {
  if (s_weather_timer) {
    app_timer_cancel(s_weather_timer);
    s_weather_timer = NULL;
  }
  uint32_t freq_ms = (uint32_t)config_get_weather_frequency() * 60 * 1000;
  s_weather_timer = app_timer_register(freq_ms, prv_weather_timer_callback, NULL);
}

/** Schedule a short retry (5 s) when the outbox is temporarily busy. */
static void prv_schedule_weather_retry(void) {
  if (s_weather_timer) {
    app_timer_cancel(s_weather_timer);
    s_weather_timer = NULL;
  }
  s_weather_timer = app_timer_register(5000, prv_weather_timer_callback, NULL);
}

/** Deferred callback so we never send from inside inbox_received. */
static void prv_deferred_request_weather(void *data) {
  (void)data;
  prv_request_weather();
}

static void prv_request_weather(void) {
  DictionaryIterator *iter;
  AppMessageResult result = app_message_outbox_begin(&iter);
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox begin failed: %d", (int)result);
    prv_schedule_weather_retry();
    return;
  }

  int32_t one = 1;
  int32_t gps = config_get_weather_use_gps();
  dict_write_int(iter, MESSAGE_KEY_GET_WEATHER, &one, sizeof(int32_t), true);
  dict_write_int(iter, MESSAGE_KEY_WEATHER_USE_GPS, &gps, sizeof(int32_t), true);
  dict_write_cstring(iter, MESSAGE_KEY_WEATHER_LOCATION, config_get_weather_location());

  result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed: %d", (int)result);
    prv_schedule_weather_retry();
    return;
  }

  prv_schedule_weather_timer();
}

// ============================================================
// Public interface
// ============================================================

void weather_create(Window *window, int16_t weather_y, int16_t date_y, int16_t padding) {
  s_window = window;
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_unobstructed_bounds(root);
  int16_t w = bounds.size.w;
  int16_t row_h = 22;

  GTextAlignment wd_align = config_text_alignment(config_get_weatherdate_alignment());
  GFont weather_font = config_weather_font();

  s_weather_layer = text_layer_create(
    GRect(padding, weather_y, (int16_t)(w - 2 * padding), row_h));
  text_layer_set_background_color(s_weather_layer, GColorClear);
  text_layer_set_text_color(s_weather_layer, config_get_wd_color());
  text_layer_set_font(s_weather_layer, weather_font);
  text_layer_set_text_alignment(s_weather_layer, wd_align);
  text_layer_set_text(s_weather_layer, "Loading...");
  layer_add_child(root, text_layer_get_layer(s_weather_layer));

  s_date_layer = text_layer_create(
    GRect(padding, date_y, (int16_t)(w - 2 * padding), row_h));
  text_layer_set_background_color(s_date_layer, GColorClear);
  text_layer_set_text_color(s_date_layer, config_get_wd_color());
  text_layer_set_font(s_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_date_layer, wd_align);
  layer_add_child(root, text_layer_get_layer(s_date_layer));

  s_js_ready      = false;
  s_show_lohi     = false;
  s_weather_timer = NULL;
}

void weather_destroy(void) {
  text_layer_destroy(s_weather_layer);
  text_layer_destroy(s_date_layer);
  s_weather_layer = NULL;
  s_date_layer    = NULL;
  if (s_weather_timer) {
    app_timer_cancel(s_weather_timer);
    s_weather_timer = NULL;
  }
}

void weather_apply_config(void) {
  text_layer_set_text_color(s_weather_layer, config_get_wd_color());
  text_layer_set_text_color(s_date_layer,    config_get_wd_color());
  text_layer_set_background_color(s_weather_layer, GColorClear);
  text_layer_set_background_color(s_date_layer,    GColorClear);

  text_layer_set_font(s_weather_layer, config_weather_font());

  GTextAlignment wd_align = config_text_alignment(config_get_weatherdate_alignment());
  text_layer_set_text_alignment(s_weather_layer, wd_align);
  text_layer_set_text_alignment(s_date_layer,    wd_align);

  prv_update_weather_display();
}

void weather_load_persisted(void) {
  if (persist_exists(MESSAGE_KEY_CONDITIONS)) {
    persist_read_string(MESSAGE_KEY_CONDITIONS,
                        s_conditions, sizeof(s_conditions));
  }
  if (persist_exists(MESSAGE_KEY_DISPLAY_WEATHER)) {
    s_weather_valid = persist_read_bool(MESSAGE_KEY_DISPLAY_WEATHER);
    if (s_weather_valid) {
      if (persist_exists(MESSAGE_KEY_TEMPERATURE))
        s_temp_f = persist_read_int(MESSAGE_KEY_TEMPERATURE);
      if (persist_exists(MESSAGE_KEY_TEMPERATURE_IN_C))
        s_temp_c = persist_read_int(MESSAGE_KEY_TEMPERATURE_IN_C);
      if (persist_exists(MESSAGE_KEY_TEMPERATURE_LO))
        s_temp_lo_f = persist_read_int(MESSAGE_KEY_TEMPERATURE_LO);
      if (persist_exists(MESSAGE_KEY_TEMPERATURE_HI))
        s_temp_hi_f = persist_read_int(MESSAGE_KEY_TEMPERATURE_HI);
      if (persist_exists(MESSAGE_KEY_TEMPERATURE_IN_C_LO))
        s_temp_lo_c = persist_read_int(MESSAGE_KEY_TEMPERATURE_IN_C_LO);
      if (persist_exists(MESSAGE_KEY_TEMPERATURE_IN_C_HI))
        s_temp_hi_c = persist_read_int(MESSAGE_KEY_TEMPERATURE_IN_C_HI);
    }
  }
}

void weather_handle_inbox(DictionaryIterator *iter) {
  Tuple *temp_t = dict_find(iter, MESSAGE_KEY_TEMPERATURE);
  if (temp_t) {
    s_temp_f = (int)temp_t->value->int32;
  }
  Tuple *temp_c_t = dict_find(iter, MESSAGE_KEY_TEMPERATURE_IN_C);
  if (temp_c_t) {
    s_temp_c = (int)temp_c_t->value->int32;
  }
  Tuple *cond_t = dict_find(iter, MESSAGE_KEY_CONDITIONS);
  if (cond_t) {
    strncpy(s_conditions, cond_t->value->cstring, sizeof(s_conditions) - 1);
    s_conditions[sizeof(s_conditions) - 1] = '\0';
  }
  Tuple *tlo_t  = dict_find(iter, MESSAGE_KEY_TEMPERATURE_LO);
  if (tlo_t)  s_temp_lo_f = (int)tlo_t->value->int32;
  Tuple *thi_t  = dict_find(iter, MESSAGE_KEY_TEMPERATURE_HI);
  if (thi_t)  s_temp_hi_f = (int)thi_t->value->int32;
  Tuple *tloc_t = dict_find(iter, MESSAGE_KEY_TEMPERATURE_IN_C_LO);
  if (tloc_t) s_temp_lo_c = (int)tloc_t->value->int32;
  Tuple *thic_t = dict_find(iter, MESSAGE_KEY_TEMPERATURE_IN_C_HI);
  if (thic_t) s_temp_hi_c = (int)thic_t->value->int32;

  if (temp_t) {
    s_weather_valid = true;
    persist_write_bool(MESSAGE_KEY_DISPLAY_WEATHER, true);
    persist_write_int(MESSAGE_KEY_TEMPERATURE, s_temp_f);
    persist_write_int(MESSAGE_KEY_TEMPERATURE_IN_C, s_temp_c);
    persist_write_string(MESSAGE_KEY_CONDITIONS, s_conditions);
    if (tlo_t)  persist_write_int(MESSAGE_KEY_TEMPERATURE_LO, s_temp_lo_f);
    if (thi_t)  persist_write_int(MESSAGE_KEY_TEMPERATURE_HI, s_temp_hi_f);
    if (tloc_t) persist_write_int(MESSAGE_KEY_TEMPERATURE_IN_C_LO, s_temp_lo_c);
    if (thic_t) persist_write_int(MESSAGE_KEY_TEMPERATURE_IN_C_HI, s_temp_hi_c);
    prv_update_weather_display();
  } else if (cond_t) {
    // Status/error message — no temperature means it's not real weather data
    s_weather_valid = false;
    persist_write_bool(MESSAGE_KEY_DISPLAY_WEATHER, false);
    persist_write_string(MESSAGE_KEY_CONDITIONS, s_conditions);
    prv_update_weather_display();
  }
}

void weather_on_js_ready(void) {
  s_js_ready = true;
  // Defer the weather request — sending from inside inbox_received can
  // silently drop the outbox message on real Bluetooth hardware.
  app_timer_register(200, prv_deferred_request_weather, NULL);
}

void weather_update_date(struct tm *tick_time) {
  if (!config_get_display_date()) {
    text_layer_set_text(s_date_layer, "");
    return;
  }
  strftime(s_date_text, sizeof(s_date_text), "%a %b %e", tick_time);
  text_layer_set_text(s_date_layer, s_date_text);
}

void weather_tap_handler(AccelAxisType axis, int32_t direction) {
  (void)axis; (void)direction;
  if (config_get_shake_for_lohi() && s_weather_valid) {
    s_show_lohi = !s_show_lohi;
    prv_update_weather_display();
  }
}

void weather_relayout(int16_t weather_y, int16_t date_y, int16_t padding) {
  Layer *root = window_get_root_layer(s_window);
  GRect bounds = layer_get_unobstructed_bounds(root);
  int16_t w = bounds.size.w;
  int16_t row_h = 22;

  layer_set_frame(text_layer_get_layer(s_weather_layer),
    GRect(padding, weather_y, (int16_t)(w - 2 * padding), row_h));
  layer_set_frame(text_layer_get_layer(s_date_layer),
    GRect(padding, date_y, (int16_t)(w - 2 * padding), row_h));
}

#endif // !PBL_PLATFORM_APLITE
