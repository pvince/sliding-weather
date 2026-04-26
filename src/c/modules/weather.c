#include "weather.h"
#include "config.h"
#include <ctype.h>

#if !defined(PBL_PLATFORM_APLITE)

#define CONDITIONS_MAXLEN      32
#define TEMP_TEXT_MAXLEN        16
#define COND_TEXT_MAXLEN        32
#define DAY_TEXT_MAXLEN         16
#define DATE_TEXT_MAXLEN        32

// Degree symbol (UTF-8)
#define DEGREE_SYMBOL "\xc2\xb0"

// ============================================================
// Module state
// ============================================================

static Window     *s_window;
static TextLayer  *s_temp_layer;
static TextLayer  *s_conditions_layer;
static TextLayer  *s_day_layer;
static TextLayer  *s_date_layer;
static int         s_temp_f;
static int         s_temp_c;
static char        s_conditions[CONDITIONS_MAXLEN];
static char        s_temp_text[TEMP_TEXT_MAXLEN];
static char        s_cond_text[COND_TEXT_MAXLEN];
static char        s_day_text[DAY_TEXT_MAXLEN];
static char        s_date_text[DATE_TEXT_MAXLEN];
static bool        s_weather_valid;
static bool        s_js_ready;
static AppTimer   *s_weather_timer;

// ============================================================
// Helpers
// ============================================================

static void prv_to_lowercase(char *str) {
  for (int i = 0; str[i]; i++) {
    str[i] = (char)tolower((unsigned char)str[i]);
  }
}

static const char *prv_ordinal_suffix(int day) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// ============================================================
// Weather display
// ============================================================

static void prv_update_weather_display(void) {
  if (!s_weather_valid) {
    if (s_conditions[0] != '\0') {
      text_layer_set_text(s_temp_layer, s_conditions);
    } else {
      text_layer_set_text(s_temp_layer, "Loading...");
    }
    text_layer_set_text(s_conditions_layer, "");
    return;
  }

  int temp = config_get_use_celsius() ? s_temp_c : s_temp_f;
  snprintf(s_temp_text, sizeof(s_temp_text), "%d" DEGREE_SYMBOL, temp);
  snprintf(s_cond_text, sizeof(s_cond_text), "%s", s_conditions);

  text_layer_set_text(s_temp_layer, s_temp_text);
  text_layer_set_text(s_conditions_layer, s_cond_text);
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

void weather_create(Window *window, int16_t bottom_y, int16_t row_h,
                    int16_t left_w, int16_t right_w,
                    int16_t left_x, int16_t right_x) {
  s_window = window;
  Layer *root = window_get_root_layer(window);

  GFont bold_font    = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
  GFont regular_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);

  // Bottom-left: temperature (bold) + conditions (regular)
  s_temp_layer = text_layer_create(
    GRect(left_x, bottom_y, left_w, row_h));
  text_layer_set_background_color(s_temp_layer, GColorClear);
  text_layer_set_text_color(s_temp_layer, config_get_wd_color());
  text_layer_set_font(s_temp_layer, bold_font);
  text_layer_set_text_alignment(s_temp_layer, GTextAlignmentLeft);
  text_layer_set_text(s_temp_layer, "Loading...");
  layer_add_child(root, text_layer_get_layer(s_temp_layer));

  s_conditions_layer = text_layer_create(
    GRect(left_x, (int16_t)(bottom_y + row_h), left_w, row_h));
  text_layer_set_background_color(s_conditions_layer, GColorClear);
  text_layer_set_text_color(s_conditions_layer, config_get_wd_color());
  text_layer_set_font(s_conditions_layer, regular_font);
  text_layer_set_text_alignment(s_conditions_layer, GTextAlignmentLeft);
  layer_add_child(root, text_layer_get_layer(s_conditions_layer));

  // Bottom-right: day name (bold) + date (regular)
  s_day_layer = text_layer_create(
    GRect(right_x, bottom_y, right_w, row_h));
  text_layer_set_background_color(s_day_layer, GColorClear);
  text_layer_set_text_color(s_day_layer, config_get_wd_color());
  text_layer_set_font(s_day_layer, bold_font);
  text_layer_set_text_alignment(s_day_layer, GTextAlignmentRight);
  layer_add_child(root, text_layer_get_layer(s_day_layer));

  s_date_layer = text_layer_create(
    GRect(right_x, (int16_t)(bottom_y + row_h), right_w, row_h));
  text_layer_set_background_color(s_date_layer, GColorClear);
  text_layer_set_text_color(s_date_layer, config_get_wd_color());
  text_layer_set_font(s_date_layer, regular_font);
  text_layer_set_text_alignment(s_date_layer, GTextAlignmentRight);
  layer_add_child(root, text_layer_get_layer(s_date_layer));

  s_js_ready      = false;
  s_weather_timer = NULL;
}

void weather_destroy(void) {
  text_layer_destroy(s_temp_layer);
  text_layer_destroy(s_conditions_layer);
  text_layer_destroy(s_day_layer);
  text_layer_destroy(s_date_layer);
  s_temp_layer       = NULL;
  s_conditions_layer = NULL;
  s_day_layer        = NULL;
  s_date_layer       = NULL;
  if (s_weather_timer) {
    app_timer_cancel(s_weather_timer);
    s_weather_timer = NULL;
  }
}

void weather_apply_config(void) {
  GColor wd_color = config_get_wd_color();
  text_layer_set_text_color(s_temp_layer,       wd_color);
  text_layer_set_text_color(s_conditions_layer,  wd_color);
  text_layer_set_text_color(s_day_layer,         wd_color);
  text_layer_set_text_color(s_date_layer,        wd_color);

  text_layer_set_background_color(s_temp_layer,       GColorClear);
  text_layer_set_background_color(s_conditions_layer,  GColorClear);
  text_layer_set_background_color(s_day_layer,         GColorClear);
  text_layer_set_background_color(s_date_layer,        GColorClear);

  text_layer_set_font(s_temp_layer,       fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_font(s_conditions_layer,  fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_font(s_day_layer,         fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD));
  text_layer_set_font(s_date_layer,        fonts_get_system_font(FONT_KEY_GOTHIC_14));

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

  if (temp_t) {
    s_weather_valid = true;
    persist_write_bool(MESSAGE_KEY_DISPLAY_WEATHER, true);
    persist_write_int(MESSAGE_KEY_TEMPERATURE, s_temp_f);
    persist_write_int(MESSAGE_KEY_TEMPERATURE_IN_C, s_temp_c);
    persist_write_string(MESSAGE_KEY_CONDITIONS, s_conditions);
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
  // Day name: lowercase full day (e.g. "sunday")
  strftime(s_day_text, sizeof(s_day_text), "%A", tick_time);
  prv_to_lowercase(s_day_text);
  text_layer_set_text(s_day_layer, s_day_text);

  // Date: "month dayth" (e.g. "april 19th")
  char month[16];
  strftime(month, sizeof(month), "%B", tick_time);
  prv_to_lowercase(month);
  int day = tick_time->tm_mday;
  snprintf(s_date_text, sizeof(s_date_text), "%s %d%s",
           month, day, prv_ordinal_suffix(day));
  text_layer_set_text(s_date_layer, s_date_text);
}

void weather_relayout(int16_t bottom_y, int16_t row_h,
                      int16_t left_w, int16_t right_w,
                      int16_t left_x, int16_t right_x) {
  layer_set_frame(text_layer_get_layer(s_temp_layer),
    GRect(left_x, bottom_y, left_w, row_h));
  layer_set_frame(text_layer_get_layer(s_conditions_layer),
    GRect(left_x, (int16_t)(bottom_y + row_h), left_w, row_h));
  layer_set_frame(text_layer_get_layer(s_day_layer),
    GRect(right_x, bottom_y, right_w, row_h));
  layer_set_frame(text_layer_get_layer(s_date_layer),
    GRect(right_x, (int16_t)(bottom_y + row_h), right_w, row_h));
}

#endif // !PBL_PLATFORM_APLITE
