#include <pebble.h>

// ============================================================
// Constants
// ============================================================

#define NUM_TIME_LINES     3
#define TIME_WORD_MAXLEN   16
#define LINE_H             49
#define LINE_GAP           -10
#define SLIDE_DURATION_MS  800

#define CONDITIONS_MAXLEN      32
#define WEATHER_TEXT_MAXLEN    48
#define DATE_TEXT_MAXLEN       24
#define WEATHER_LOCATION_MAXLEN 64

// Alignment values (match config page)
#define ALIGN_CENTER 0
#define ALIGN_LEFT   1
#define ALIGN_RIGHT  2

// Font readability options for weather/date
#define RDBL_SMALL       0
#define RDBL_SMALL_BOLD  1
#define RDBL_LARGE       2
#define RDBL_LARGE_BOLD  3

// Default config values
#define DEFAULT_BG_COLOR       0x000000
#define DEFAULT_HR_COLOR       0xFFFFFF
#define DEFAULT_MIN_COLOR      0xFFFFFF
#define DEFAULT_WD_COLOR       0xFFFFFF
#define DEFAULT_WEATHER_FREQ   30   // minutes
#define DEFAULT_USE_CELSIUS    0
#define DEFAULT_DISPLAY_PREFIX 1
#define DEFAULT_DISPLAY_DATE   1
#define DEFAULT_SHAKE_LOHI     0
#define DEFAULT_VIBBRATE_BT    1
#define DEFAULT_WEATHER_GPS    1
#define DEFAULT_WD_ALIGNMENT   ALIGN_CENTER
#define DEFAULT_HM_ALIGNMENT   ALIGN_LEFT
#define DEFAULT_WD_READABILITY RDBL_SMALL

// Degree symbol (UTF-8)
#define DEGREE_SYMBOL "\xc2\xb0"

// ============================================================
// Word lookup tables
// ============================================================

static const char *s_hours[] = {
  "", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve"
};
static const char *s_ones[] = {
  "", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine"
};
static const char *s_teens[] = {
  "ten", "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
};
static const char *s_tens[] = {
  "", "", "twenty", "thirty", "forty", "fifty"
};

// ============================================================
// Globals
// ============================================================

static Window         *s_window;
static TextLayer      *s_time_layer[NUM_TIME_LINES];
static char            s_time_text[NUM_TIME_LINES][TIME_WORD_MAXLEN];
static PropertyAnimation *s_line_anim[NUM_TIME_LINES];
static GRect           s_line_target[NUM_TIME_LINES];

#ifndef PBL_PLATFORM_APLITE
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
#endif

// Config
static GColor  s_bg_color;
static GColor  s_hr_color;
static GColor  s_min_color;
static GColor  s_wd_color;
static int     s_use_celsius;
static int     s_display_o_prefix;
static int     s_display_date;
static int     s_shake_for_lohi;
static int     s_weatherdate_alignment;
static int     s_hourminutes_alignment;
static int     s_weatherdate_readability;
static int     s_weather_frequency;   // minutes
static int     s_vibbrate_bt;
static int     s_weather_use_gps;
static char    s_weather_location[WEATHER_LOCATION_MAXLEN];

// ============================================================
// Helpers
// ============================================================

static GColor prv_color_from_hex(int hex) {
#if defined(PBL_COLOR)
  return GColorFromHEX(hex);
#else
  // Map to B&W by luminance
  int r = (hex >> 16) & 0xFF;
  int g = (hex >> 8) & 0xFF;
  int b = hex & 0xFF;
  int luma = (r * 299 + g * 587 + b * 114) / 1000;
  return (luma > 128) ? GColorWhite : GColorBlack;
#endif
}

static GTextAlignment prv_text_alignment(int val) {
  switch (val) {
    case ALIGN_LEFT:  return GTextAlignmentLeft;
    case ALIGN_RIGHT: return GTextAlignmentRight;
    default:          return GTextAlignmentCenter;
  }
}

#ifndef PBL_PLATFORM_APLITE
static GFont prv_weather_font(int readability) {
  switch (readability) {
    case RDBL_SMALL:      return fonts_get_system_font(FONT_KEY_GOTHIC_18);
    case RDBL_LARGE:      return fonts_get_system_font(FONT_KEY_GOTHIC_24);
    case RDBL_LARGE_BOLD: return fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);
    default:              return fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  }
}
#endif

// ============================================================
// Word time computation
// ============================================================

// Pick the appropriate minute font based on text length.
// Teen words >= 8 chars (thirteen, fourteen, seventeen, eighteen, nineteen)
// are too wide for FONT_KEY_BITHAM_42_LIGHT in the available layer width.
static GFont prv_min_font(const char *text) {
  if (strlen(text) >= 8) {
    return fonts_get_system_font(FONT_KEY_GOTHIC_28);
  }
  return fonts_get_system_font(FONT_KEY_BITHAM_42_LIGHT);
}

static void prv_compute_time_words(int hour, int minute,
                                   char out[NUM_TIME_LINES][TIME_WORD_MAXLEN]) {
  // hour is already 1..12
  strncpy(out[0], s_hours[hour], TIME_WORD_MAXLEN - 1);
  out[0][TIME_WORD_MAXLEN - 1] = '\0';

  if (minute == 0) {
    strncpy(out[1], "o'clock", TIME_WORD_MAXLEN - 1);
    out[1][TIME_WORD_MAXLEN - 1] = '\0';
    out[2][0] = '\0';
  } else if (minute >= 1 && minute <= 9) {
    strncpy(out[1], s_ones[minute], TIME_WORD_MAXLEN - 1);
    out[1][TIME_WORD_MAXLEN - 1] = '\0';
    out[2][0] = '\0';
  } else if (minute >= 10 && minute <= 19) {
    strncpy(out[1], s_teens[minute - 10], TIME_WORD_MAXLEN - 1);
    out[1][TIME_WORD_MAXLEN - 1] = '\0';
    out[2][0] = '\0';
  } else if (minute % 10 == 0) {
    strncpy(out[1], s_tens[minute / 10], TIME_WORD_MAXLEN - 1);
    out[1][TIME_WORD_MAXLEN - 1] = '\0';
    out[2][0] = '\0';
  } else {
    strncpy(out[1], s_tens[minute / 10], TIME_WORD_MAXLEN - 1);
    out[1][TIME_WORD_MAXLEN - 1] = '\0';
    strncpy(out[2], s_ones[minute % 10], TIME_WORD_MAXLEN - 1);
    out[2][TIME_WORD_MAXLEN - 1] = '\0';
  }
}

// ============================================================
// Slide animation
// ============================================================

static void prv_slide_stopped(Animation *anim, bool finished, void *context) {
  (void)anim; (void)finished;
  int idx = (int)(uintptr_t)context;
  s_line_anim[idx] = NULL;
}

static void prv_slide_in_line(int idx) {
  if (s_line_anim[idx]) {
    PropertyAnimation *old = s_line_anim[idx];
    s_line_anim[idx] = NULL;  // clear before unschedule triggers stopped handler
    animation_unschedule(property_animation_get_animation(old));
    property_animation_destroy(old);
  }

  Layer *root = window_get_root_layer(s_window);
  GRect root_bounds = layer_get_bounds(root);
  int16_t screen_w = root_bounds.size.w;

  GRect target = s_line_target[idx];
  GRect start = GRect(screen_w, target.origin.y, target.size.w, target.size.h);

  Layer *layer = text_layer_get_layer(s_time_layer[idx]);
  layer_set_frame(layer, start);
  layer_set_hidden(layer, false);

  s_line_anim[idx] = property_animation_create_layer_frame(layer, &start, &target);
  Animation *anim = property_animation_get_animation(s_line_anim[idx]);
  animation_set_duration(anim, SLIDE_DURATION_MS);
  animation_set_curve(anim, AnimationCurveEaseOut);
  animation_set_handlers(anim,
    (AnimationHandlers){ .stopped = prv_slide_stopped },
    (void *)(uintptr_t)idx);
  animation_schedule(anim);
}

// ============================================================
// Time display
// ============================================================

static void prv_set_time(struct tm *tick_time) {
  int hour = tick_time->tm_hour % 12;
  if (hour == 0) hour = 12;

  char new_text[NUM_TIME_LINES][TIME_WORD_MAXLEN];
  prv_compute_time_words(hour, tick_time->tm_min, new_text);

  for (int i = 0; i < NUM_TIME_LINES; i++) {
    if (new_text[i][0] == '\0' && s_time_text[i][0] != '\0') {
      s_time_text[i][0] = '\0';
      layer_set_hidden(text_layer_get_layer(s_time_layer[i]), true);
    } else if (new_text[i][0] != '\0' && strcmp(new_text[i], s_time_text[i]) != 0) {
      strncpy(s_time_text[i], new_text[i], TIME_WORD_MAXLEN - 1);
      s_time_text[i][TIME_WORD_MAXLEN - 1] = '\0';
      if (i > 0) {
        text_layer_set_font(s_time_layer[i], prv_min_font(s_time_text[i]));
      }
      text_layer_set_text(s_time_layer[i], s_time_text[i]);
      prv_slide_in_line(i);
    }
  }
}

// ============================================================
// Weather display (non-aplite only)
// ============================================================

#ifndef PBL_PLATFORM_APLITE

static void prv_update_weather_display(void) {
  if (!s_weather_valid) {
    if (s_conditions[0] != '\0') {
      text_layer_set_text(s_weather_layer, s_conditions);
    } else {
      text_layer_set_text(s_weather_layer, "Loading...");
    }
    return;
  }

  if (s_show_lohi && s_shake_for_lohi) {
    int lo = s_use_celsius ? s_temp_lo_c : s_temp_lo_f;
    int hi = s_use_celsius ? s_temp_hi_c : s_temp_hi_f;
    if (s_display_o_prefix) {
      snprintf(s_weather_text, sizeof(s_weather_text),
               "H:%d" DEGREE_SYMBOL " L:%d" DEGREE_SYMBOL, hi, lo);
    } else {
      snprintf(s_weather_text, sizeof(s_weather_text), "H:%d L:%d", hi, lo);
    }
  } else {
    int temp = s_use_celsius ? s_temp_c : s_temp_f;
    if (s_display_o_prefix) {
      snprintf(s_weather_text, sizeof(s_weather_text),
               "%d" DEGREE_SYMBOL " %s", temp, s_conditions);
    } else {
      snprintf(s_weather_text, sizeof(s_weather_text), "%d %s", temp, s_conditions);
    }
  }

  text_layer_set_text(s_weather_layer, s_weather_text);
}

static void prv_update_date_display(struct tm *tick_time) {
  if (!s_display_date) {
    text_layer_set_text(s_date_layer, "");
    return;
  }
  strftime(s_date_text, sizeof(s_date_text), "%a %b %e", tick_time);
  text_layer_set_text(s_date_layer, s_date_text);
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
  uint32_t freq_ms = (uint32_t)s_weather_frequency * 60 * 1000;
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
  dict_write_int(iter, MESSAGE_KEY_GET_WEATHER, &one, sizeof(int32_t), true);
  dict_write_int(iter, MESSAGE_KEY_WEATHER_USE_GPS, &s_weather_use_gps, sizeof(int32_t), true);
  dict_write_cstring(iter, MESSAGE_KEY_WEATHER_LOCATION, s_weather_location);

  result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed: %d", (int)result);
    prv_schedule_weather_retry();
    return;
  }

  prv_schedule_weather_timer();
}

// ============================================================
// Tap handler (shake for hi/lo)
// ============================================================

static void prv_tap_handler(AccelAxisType axis, int32_t direction) {
  (void)axis; (void)direction;
  if (s_shake_for_lohi && s_weather_valid) {
    s_show_lohi = !s_show_lohi;
    prv_update_weather_display();
  }
}

#endif // !PBL_PLATFORM_APLITE

// ============================================================
// Bluetooth handler
// ============================================================

static void prv_bt_handler(bool connected) {
  if (!connected && s_vibbrate_bt) {
    vibes_double_pulse();
  }
}

// ============================================================
// AppMessage handlers
// ============================================================

static void prv_apply_config(void) {
  window_set_background_color(s_window, s_bg_color);

#ifndef PBL_PLATFORM_APLITE
  text_layer_set_text_color(s_weather_layer, s_wd_color);
  text_layer_set_text_color(s_date_layer,    s_wd_color);
  text_layer_set_background_color(s_weather_layer, GColorClear);
  text_layer_set_background_color(s_date_layer,    GColorClear);

  text_layer_set_font(s_weather_layer, prv_weather_font(s_weatherdate_readability));

  GTextAlignment wd_align = prv_text_alignment(s_weatherdate_alignment);
  text_layer_set_text_alignment(s_weather_layer, wd_align);
  text_layer_set_text_alignment(s_date_layer,    wd_align);
#endif

  // Redraw time layers to pick up new colors/alignment
  GTextAlignment time_align = prv_text_alignment(s_hourminutes_alignment);
  for (int i = 0; i < NUM_TIME_LINES; i++) {
    text_layer_set_text_color(s_time_layer[i], (i == 0) ? s_hr_color : s_min_color);
    text_layer_set_text_alignment(s_time_layer[i], time_align);
  }
}

static void prv_inbox_received_handler(DictionaryIterator *iter, void *context) {
  (void)context;

  // ----- JS Ready -----
  Tuple *js_ready_t = dict_find(iter, MESSAGE_KEY_JS_READY);
#ifndef PBL_PLATFORM_APLITE
  if (js_ready_t && js_ready_t->value->int32 == 1) {
    s_js_ready = true;
    // Defer the weather request — sending from inside inbox_received can
    // silently drop the outbox message on real Bluetooth hardware.
    app_timer_register(200, prv_deferred_request_weather, NULL);
    return;
  }
#else
  (void)js_ready_t;
#endif

#ifndef PBL_PLATFORM_APLITE
  // ----- Weather data -----
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
#endif

  // ----- Config -----
  bool config_changed = false;

  Tuple *bg_t = dict_find(iter, MESSAGE_KEY_BACKGROUND_COLOR);
  if (bg_t) {
    int hex = (int)bg_t->value->int32;
    persist_write_int(MESSAGE_KEY_BACKGROUND_COLOR, hex);
    s_bg_color = prv_color_from_hex(hex);
    config_changed = true;
  }
  Tuple *hr_t = dict_find(iter, MESSAGE_KEY_HR_COLOR);
  if (hr_t) {
    int hex = (int)hr_t->value->int32;
    persist_write_int(MESSAGE_KEY_HR_COLOR, hex);
    s_hr_color = prv_color_from_hex(hex);
    config_changed = true;
  }
  Tuple *mn_t = dict_find(iter, MESSAGE_KEY_MIN_COLOR);
  if (mn_t) {
    int hex = (int)mn_t->value->int32;
    persist_write_int(MESSAGE_KEY_MIN_COLOR, hex);
    s_min_color = prv_color_from_hex(hex);
    config_changed = true;
  }
  Tuple *wd_t = dict_find(iter, MESSAGE_KEY_WD_COLOR);
  if (wd_t) {
    int hex = (int)wd_t->value->int32;
    persist_write_int(MESSAGE_KEY_WD_COLOR, hex);
    s_wd_color = prv_color_from_hex(hex);
    config_changed = true;
  }
  Tuple *freq_t = dict_find(iter, MESSAGE_KEY_WEATHER_FREQUENCY);
  if (freq_t) {
    s_weather_frequency = (int)freq_t->value->int32;
    persist_write_int(MESSAGE_KEY_WEATHER_FREQUENCY, s_weather_frequency);
  }
  Tuple *cel_t = dict_find(iter, MESSAGE_KEY_USE_CELSIUS);
  if (cel_t) {
    s_use_celsius = (int)cel_t->value->int32;
    persist_write_int(MESSAGE_KEY_USE_CELSIUS, s_use_celsius);
    config_changed = true;
  }
  Tuple *pfx_t = dict_find(iter, MESSAGE_KEY_DISPLAY_O_PREFIX);
  if (pfx_t) {
    s_display_o_prefix = (int)pfx_t->value->int32;
    persist_write_int(MESSAGE_KEY_DISPLAY_O_PREFIX, s_display_o_prefix);
    config_changed = true;
  }
  Tuple *date_t = dict_find(iter, MESSAGE_KEY_DISPLAY_DATE);
  if (date_t) {
    s_display_date = (int)date_t->value->int32;
    persist_write_int(MESSAGE_KEY_DISPLAY_DATE, s_display_date);
    config_changed = true;
  }
  Tuple *shk_t = dict_find(iter, MESSAGE_KEY_SHAKE_FOR_LOHI);
  if (shk_t) {
    s_shake_for_lohi = (int)shk_t->value->int32;
    persist_write_int(MESSAGE_KEY_SHAKE_FOR_LOHI, s_shake_for_lohi);
  }
  Tuple *vib_t = dict_find(iter, MESSAGE_KEY_VIBBRATE_BT_STATUS);
  if (vib_t) {
    s_vibbrate_bt = (int)vib_t->value->int32;
    persist_write_int(MESSAGE_KEY_VIBBRATE_BT_STATUS, s_vibbrate_bt);
  }
  Tuple *gps_t = dict_find(iter, MESSAGE_KEY_WEATHER_USE_GPS);
  if (gps_t) {
    s_weather_use_gps = (int)gps_t->value->int32;
    persist_write_int(MESSAGE_KEY_WEATHER_USE_GPS, s_weather_use_gps);
  }
  Tuple *loc_t = dict_find(iter, MESSAGE_KEY_WEATHER_LOCATION);
  if (loc_t) {
    strncpy(s_weather_location, loc_t->value->cstring, sizeof(s_weather_location) - 1);
    s_weather_location[sizeof(s_weather_location) - 1] = '\0';
    persist_write_string(MESSAGE_KEY_WEATHER_LOCATION, s_weather_location);
  }
  Tuple *wda_t = dict_find(iter, MESSAGE_KEY_WEATHERDATE_ALIGNMENT);
  if (wda_t) {
    s_weatherdate_alignment = (int)wda_t->value->int32;
    persist_write_int(MESSAGE_KEY_WEATHERDATE_ALIGNMENT, s_weatherdate_alignment);
    config_changed = true;
  }
  Tuple *hma_t = dict_find(iter, MESSAGE_KEY_HOURMINUTES_ALIGNMENT);
  if (hma_t) {
    s_hourminutes_alignment = (int)hma_t->value->int32;
    persist_write_int(MESSAGE_KEY_HOURMINUTES_ALIGNMENT, s_hourminutes_alignment);
    config_changed = true;
  }
  Tuple *wdr_t = dict_find(iter, MESSAGE_KEY_WEATHERDATE_READABILITY);
  if (wdr_t) {
    s_weatherdate_readability = (int)wdr_t->value->int32;
    persist_write_int(MESSAGE_KEY_WEATHERDATE_READABILITY, s_weatherdate_readability);
    config_changed = true;
  }

  if (config_changed) {
    prv_apply_config();
#ifndef PBL_PLATFORM_APLITE
    prv_update_weather_display();
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
// Tick handler
// ============================================================

static void prv_tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  (void)units_changed;
  prv_set_time(tick_time);

#ifndef PBL_PLATFORM_APLITE
  prv_update_date_display(tick_time);
#endif
}

// ============================================================
// Config persistence
// ============================================================

static void prv_load_config(void) {
  s_bg_color  = prv_color_from_hex(persist_exists(MESSAGE_KEY_BACKGROUND_COLOR)
                  ? persist_read_int(MESSAGE_KEY_BACKGROUND_COLOR) : DEFAULT_BG_COLOR);
  s_hr_color  = prv_color_from_hex(persist_exists(MESSAGE_KEY_HR_COLOR)
                  ? persist_read_int(MESSAGE_KEY_HR_COLOR)  : DEFAULT_HR_COLOR);
  s_min_color = prv_color_from_hex(persist_exists(MESSAGE_KEY_MIN_COLOR)
                  ? persist_read_int(MESSAGE_KEY_MIN_COLOR) : DEFAULT_MIN_COLOR);
  s_wd_color  = prv_color_from_hex(persist_exists(MESSAGE_KEY_WD_COLOR)
                  ? persist_read_int(MESSAGE_KEY_WD_COLOR)  : DEFAULT_WD_COLOR);

  s_weather_frequency = persist_exists(MESSAGE_KEY_WEATHER_FREQUENCY)
    ? persist_read_int(MESSAGE_KEY_WEATHER_FREQUENCY) : DEFAULT_WEATHER_FREQ;
  s_use_celsius = persist_exists(MESSAGE_KEY_USE_CELSIUS)
    ? persist_read_int(MESSAGE_KEY_USE_CELSIUS) : DEFAULT_USE_CELSIUS;
  s_display_o_prefix = persist_exists(MESSAGE_KEY_DISPLAY_O_PREFIX)
    ? persist_read_int(MESSAGE_KEY_DISPLAY_O_PREFIX) : DEFAULT_DISPLAY_PREFIX;
  s_display_date = persist_exists(MESSAGE_KEY_DISPLAY_DATE)
    ? persist_read_int(MESSAGE_KEY_DISPLAY_DATE) : DEFAULT_DISPLAY_DATE;
  s_shake_for_lohi = persist_exists(MESSAGE_KEY_SHAKE_FOR_LOHI)
    ? persist_read_int(MESSAGE_KEY_SHAKE_FOR_LOHI) : DEFAULT_SHAKE_LOHI;
  s_vibbrate_bt = persist_exists(MESSAGE_KEY_VIBBRATE_BT_STATUS)
    ? persist_read_int(MESSAGE_KEY_VIBBRATE_BT_STATUS) : DEFAULT_VIBBRATE_BT;
  s_weather_use_gps = persist_exists(MESSAGE_KEY_WEATHER_USE_GPS)
    ? persist_read_int(MESSAGE_KEY_WEATHER_USE_GPS) : DEFAULT_WEATHER_GPS;
  s_weatherdate_alignment = persist_exists(MESSAGE_KEY_WEATHERDATE_ALIGNMENT)
    ? persist_read_int(MESSAGE_KEY_WEATHERDATE_ALIGNMENT) : DEFAULT_WD_ALIGNMENT;
  s_hourminutes_alignment = persist_exists(MESSAGE_KEY_HOURMINUTES_ALIGNMENT)
    ? persist_read_int(MESSAGE_KEY_HOURMINUTES_ALIGNMENT) : DEFAULT_HM_ALIGNMENT;
  s_weatherdate_readability = persist_exists(MESSAGE_KEY_WEATHERDATE_READABILITY)
    ? persist_read_int(MESSAGE_KEY_WEATHERDATE_READABILITY) : DEFAULT_WD_READABILITY;

  s_weather_location[0] = '\0';
  if (persist_exists(MESSAGE_KEY_WEATHER_LOCATION)) {
    persist_read_string(MESSAGE_KEY_WEATHER_LOCATION,
                        s_weather_location, sizeof(s_weather_location));
  }
}

#ifndef PBL_PLATFORM_APLITE
static void prv_load_weather(void) {
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
#endif

// ============================================================
// Window lifecycle
// ============================================================

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);
  int16_t w = bounds.size.w;
  int16_t h = bounds.size.h;

  int16_t padding = PBL_IF_ROUND_ELSE(20, 4);

#ifndef PBL_PLATFORM_APLITE
  // Weather at top
  int16_t weather_y = PBL_IF_ROUND_ELSE(10, 2);
  int16_t row_h = 22;
  // Date at bottom
  int16_t date_y = h - row_h - PBL_IF_ROUND_ELSE(10, 2);
  // Time words centered between weather bottom and date top
  int16_t time_block_h = NUM_TIME_LINES * LINE_H + (NUM_TIME_LINES - 1) * LINE_GAP;
  int16_t time_top = weather_y + row_h;
  int16_t time_bottom = date_y;
  int16_t time_start_y = time_top + (time_bottom - time_top - time_block_h) / 2;
#else
  int16_t time_block_h = NUM_TIME_LINES * LINE_H + (NUM_TIME_LINES - 1) * LINE_GAP;
  int16_t time_start_y = (h - time_block_h) / 2;
#endif

#ifndef PBL_PLATFORM_APLITE
  // Weather layer (at top)
  GTextAlignment wd_align = prv_text_alignment(s_weatherdate_alignment);
  GFont weather_font = prv_weather_font(s_weatherdate_readability);

  s_weather_layer = text_layer_create(
    GRect(padding, weather_y, (int16_t)(w - 2 * padding), row_h));
  text_layer_set_background_color(s_weather_layer, GColorClear);
  text_layer_set_text_color(s_weather_layer, s_wd_color);
  text_layer_set_font(s_weather_layer, weather_font);
  text_layer_set_text_alignment(s_weather_layer, wd_align);
  text_layer_set_text(s_weather_layer, "Loading...");
  layer_add_child(root, text_layer_get_layer(s_weather_layer));
#endif

  // Create time word layers
  GFont hr_font  = fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
  GFont min_font = fonts_get_system_font(FONT_KEY_BITHAM_42_LIGHT);
  GTextAlignment time_align = prv_text_alignment(s_hourminutes_alignment);
  for (int i = 0; i < NUM_TIME_LINES; i++) {
    int16_t ly = time_start_y + i * (LINE_H + LINE_GAP);
    s_line_target[i] = GRect(padding, ly, w - 2 * padding, LINE_H);
    s_time_layer[i] = text_layer_create(s_line_target[i]);
    text_layer_set_background_color(s_time_layer[i], GColorClear);
    text_layer_set_text_color(s_time_layer[i], (i == 0) ? s_hr_color : s_min_color);
    text_layer_set_font(s_time_layer[i], (i == 0) ? hr_font : min_font);
    text_layer_set_text_alignment(s_time_layer[i], time_align);
    layer_add_child(root, text_layer_get_layer(s_time_layer[i]));
    s_time_text[i][0] = '\0';
    s_line_anim[i] = NULL;
  }

#ifndef PBL_PLATFORM_APLITE
  // Date layer (at bottom)
  s_date_layer = text_layer_create(
    GRect(padding, date_y, (int16_t)(w - 2 * padding), row_h));
  text_layer_set_background_color(s_date_layer, GColorClear);
  text_layer_set_text_color(s_date_layer, s_wd_color);
  text_layer_set_font(s_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_date_layer, wd_align);
  layer_add_child(root, text_layer_get_layer(s_date_layer));
#endif

  prv_apply_config();

  // Snap to current time WITHOUT animation on initial load
  time_t now = time(NULL);
  struct tm *tick_time = localtime(&now);
  char init_text[NUM_TIME_LINES][TIME_WORD_MAXLEN];
  int hour = tick_time->tm_hour % 12;
  if (hour == 0) hour = 12;
  prv_compute_time_words(hour, tick_time->tm_min, init_text);
  for (int i = 0; i < NUM_TIME_LINES; i++) {
    strncpy(s_time_text[i], init_text[i], TIME_WORD_MAXLEN - 1);
    s_time_text[i][TIME_WORD_MAXLEN - 1] = '\0';
    if (i > 0 && s_time_text[i][0] != '\0') {
      text_layer_set_font(s_time_layer[i], prv_min_font(s_time_text[i]));
    }
    text_layer_set_text(s_time_layer[i], s_time_text[i]);
    if (s_time_text[i][0] == '\0') {
      layer_set_hidden(text_layer_get_layer(s_time_layer[i]), true);
    }
  }

#ifndef PBL_PLATFORM_APLITE
  prv_update_date_display(tick_time);
  prv_update_weather_display();
#endif
}

static void prv_window_unload(Window *window) {
  (void)window;

  for (int i = 0; i < NUM_TIME_LINES; i++) {
    if (s_line_anim[i]) {
      PropertyAnimation *old = s_line_anim[i];
      s_line_anim[i] = NULL;
      animation_unschedule(property_animation_get_animation(old));
      property_animation_destroy(old);
    }
    text_layer_destroy(s_time_layer[i]);
    s_time_layer[i] = NULL;
  }

#ifndef PBL_PLATFORM_APLITE
  text_layer_destroy(s_weather_layer);
  text_layer_destroy(s_date_layer);
  s_weather_layer = NULL;
  s_date_layer    = NULL;
  if (s_weather_timer) {
    app_timer_cancel(s_weather_timer);
    s_weather_timer = NULL;
  }
#endif
}

// ============================================================
// Init / Deinit
// ============================================================

static void prv_init(void) {
  prv_load_config();
#ifndef PBL_PLATFORM_APLITE
  prv_load_weather();
#endif

  s_window = window_create();
  window_set_background_color(s_window, s_bg_color);
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

#ifndef PBL_PLATFORM_APLITE
  accel_tap_service_subscribe(prv_tap_handler);
  s_js_ready      = false;
  s_show_lohi     = false;
  s_weather_timer = NULL;
#endif

  window_stack_push(s_window, true);
}

static void prv_deinit(void) {
  tick_timer_service_unsubscribe();
  bluetooth_connection_service_unsubscribe();

#ifndef PBL_PLATFORM_APLITE
  accel_tap_service_unsubscribe();
  if (s_weather_timer) {
    app_timer_cancel(s_weather_timer);
    s_weather_timer = NULL;
  }
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

