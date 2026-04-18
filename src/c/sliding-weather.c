#include <pebble.h>

// ============================================================
// Constants
// ============================================================

#define NUM_DIGITS      4
#define DIGIT_W         26
#define DIGIT_H         56
#define DIGIT_GAP       2
#define COLON_W         16
#define ANIM_DURATION_MS 300

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
#define DEFAULT_HM_ALIGNMENT   ALIGN_CENTER
#define DEFAULT_WD_READABILITY RDBL_SMALL_BOLD
#define DEFAULT_MIN_READABILITY RDBL_SMALL

// Degree symbol (UTF-8)
#define DEGREE_SYMBOL "\xc2\xb0"

// ============================================================
// Types
// ============================================================

typedef struct {
  int current;   // digit value 0-9 currently displayed
  int next;      // digit value 0-9 animating to
  int offset;    // animation scroll offset, 0..DIGIT_H
} DigitState;

// ============================================================
// Globals
// ============================================================

static Window         *s_window;
static Layer          *s_digit_layer[NUM_DIGITS];
static Layer          *s_colon_layer;
static DigitState      s_digits[NUM_DIGITS];
static Animation      *s_anim;

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

static GFont prv_digit_font(void) {
#if defined(PBL_COLOR)
  return fonts_get_system_font(FONT_KEY_LECO_42_NUMBERS);
#else
  return fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
#endif
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
// Digit layers
// ============================================================

static void prv_digit_update_proc(Layer *layer, GContext *ctx) {
  int *idx_ptr = (int *)layer_get_data(layer);
  int idx = *idx_ptr;
  DigitState *d = &s_digits[idx];
  GRect bounds = layer_get_bounds(layer);
  GFont font = prv_digit_font();
  GColor text_color = (idx < 2) ? s_hr_color : s_min_color;

  graphics_context_set_text_color(ctx, text_color);

  char cur_str[2] = { (char)('0' + d->current), '\0' };
  char nxt_str[2] = { (char)('0' + d->next),    '\0' };

  if (d->offset == 0) {
    graphics_draw_text(ctx, cur_str, font, bounds,
                       GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  } else {
    // Outgoing digit slides upward
    GRect out_rect = GRect(0, -(int16_t)d->offset, bounds.size.w, bounds.size.h);
    // Incoming digit enters from below
    GRect in_rect  = GRect(0, (int16_t)(bounds.size.h - d->offset), bounds.size.w, bounds.size.h);
    graphics_draw_text(ctx, cur_str, font, out_rect,
                       GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
    graphics_draw_text(ctx, nxt_str, font, in_rect,
                       GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  }
}

static void prv_colon_update_proc(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, s_hr_color);
  int cx = bounds.size.w / 2;
  int radius = 3;
  graphics_fill_circle(ctx, GPoint(cx, bounds.size.h / 3),     radius);
  graphics_fill_circle(ctx, GPoint(cx, 2 * bounds.size.h / 3), radius);
}

// ============================================================
// Digit animation
// ============================================================

static void prv_anim_update(Animation *anim, AnimationProgress progress) {
  (void)anim;
  for (int i = 0; i < NUM_DIGITS; i++) {
    if (s_digits[i].current != s_digits[i].next) {
      s_digits[i].offset = (int)((DIGIT_H * (int32_t)progress) / ANIMATION_NORMALIZED_MAX);
      layer_mark_dirty(s_digit_layer[i]);
    }
  }
}

static void prv_anim_stopped(Animation *anim, bool finished, void *context) {
  (void)anim; (void)finished; (void)context;
  for (int i = 0; i < NUM_DIGITS; i++) {
    s_digits[i].current = s_digits[i].next;
    s_digits[i].offset  = 0;
    layer_mark_dirty(s_digit_layer[i]);
  }
  s_anim = NULL;
}

static void prv_start_animation(void) {
  if (s_anim) {
    animation_unschedule(s_anim);
    s_anim = NULL;
    // Snap digits to final state before restarting
    for (int i = 0; i < NUM_DIGITS; i++) {
      s_digits[i].current = s_digits[i].next;
      s_digits[i].offset  = 0;
    }
  }

  static const AnimationImplementation s_impl = {
    .update = prv_anim_update
  };

  s_anim = animation_create();
  animation_set_implementation(s_anim, &s_impl);
  animation_set_duration(s_anim, ANIM_DURATION_MS);
  animation_set_curve(s_anim, AnimationCurveEaseInOut);
  animation_set_handlers(s_anim,
    (AnimationHandlers){ .stopped = prv_anim_stopped }, NULL);
  animation_schedule(s_anim);
}

// ============================================================
// Time display
// ============================================================

static void prv_set_time(struct tm *tick_time) {
  int hour = tick_time->tm_hour;
  if (!clock_is_24h_style()) {
    if (hour == 0)       hour = 12;
    else if (hour > 12)  hour -= 12;
  }

  int new_vals[NUM_DIGITS] = {
    hour / 10, hour % 10,
    tick_time->tm_min / 10, tick_time->tm_min % 10
  };

  bool any_changed = false;
  for (int i = 0; i < NUM_DIGITS; i++) {
    s_digits[i].next = new_vals[i];
    if (new_vals[i] != s_digits[i].current) any_changed = true;
  }

  if (any_changed) {
    prv_start_animation();
  }
}

// ============================================================
// Weather display (non-aplite only)
// ============================================================

#ifndef PBL_PLATFORM_APLITE

static void prv_update_weather_display(void) {
  if (!s_weather_valid) {
    text_layer_set_text(s_weather_layer, "Loading...");
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

static void prv_request_weather(void) {
  DictionaryIterator *iter;
  AppMessageResult result = app_message_outbox_begin(&iter);
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox begin failed: %d", (int)result);
    prv_schedule_weather_timer();
    return;
  }

  int32_t one = 1;
  dict_write_int(iter, MESSAGE_KEY_GET_WEATHER, &one, sizeof(int32_t), true);
  dict_write_int(iter, MESSAGE_KEY_WEATHER_USE_GPS, &s_weather_use_gps, sizeof(int32_t), true);
  dict_write_cstring(iter, MESSAGE_KEY_WEATHER_LOCATION, s_weather_location);

  result = app_message_outbox_send();
  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed: %d", (int)result);
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

  // Redraw digit and colon layers to pick up new colors
  for (int i = 0; i < NUM_DIGITS; i++) {
    layer_mark_dirty(s_digit_layer[i]);
  }
  if (s_colon_layer) layer_mark_dirty(s_colon_layer);
}

static void prv_inbox_received_handler(DictionaryIterator *iter, void *context) {
  (void)context;

  // ----- JS Ready -----
  Tuple *js_ready_t = dict_find(iter, MESSAGE_KEY_JS_READY);
#ifndef PBL_PLATFORM_APLITE
  if (js_ready_t && js_ready_t->value->int32 == 1) {
    s_js_ready = true;
    prv_request_weather();
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

// ============================================================
// Window lifecycle
// ============================================================

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);
  int16_t w = bounds.size.w;
  int16_t h = bounds.size.h;

  // Calculate time row geometry
  int16_t time_total_w = (int16_t)(4 * DIGIT_W + 4 * DIGIT_GAP + COLON_W);
  int16_t time_x       = (w - time_total_w) / 2;

#ifdef PBL_PLATFORM_APLITE
  // Center vertically on full screen for aplite (time only)
  int16_t time_y = (h - DIGIT_H) / 2;
#else
  // Upper portion; weather/date below
  int16_t time_y = (int16_t)(h / 6);
#endif

  // Create digit layers
  int16_t cx = time_x;
  for (int i = 0; i < NUM_DIGITS; i++) {
    // Skip colon gap between H2 and M1
    if (i == 2) cx = (int16_t)(cx + COLON_W + DIGIT_GAP);

    GRect frame = GRect(cx, time_y, DIGIT_W, DIGIT_H);
    s_digit_layer[i] = layer_create_with_data(frame, sizeof(int));
    int *idx_ptr = (int *)layer_get_data(s_digit_layer[i]);
    *idx_ptr = i;
    layer_set_update_proc(s_digit_layer[i], prv_digit_update_proc);
    layer_add_child(root, s_digit_layer[i]);

    s_digits[i].current = 0;
    s_digits[i].next    = 0;
    s_digits[i].offset  = 0;

    cx = (int16_t)(cx + DIGIT_W + DIGIT_GAP);
  }

  // Create colon layer (between H2 and M1)
  int16_t colon_x = (int16_t)(time_x + 2 * (DIGIT_W + DIGIT_GAP));
  s_colon_layer = layer_create(GRect(colon_x, time_y, COLON_W, DIGIT_H));
  layer_set_update_proc(s_colon_layer, prv_colon_update_proc);
  layer_add_child(root, s_colon_layer);

#ifndef PBL_PLATFORM_APLITE
  // Weather and date layers below time
  int16_t weather_y = (int16_t)(time_y + DIGIT_H + 10);
  int16_t date_y    = (int16_t)(weather_y + 22);
  int16_t row_h     = 22;
  int16_t padding   = PBL_IF_ROUND_ELSE(20, 4);

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

  s_date_layer = text_layer_create(
    GRect(padding, date_y, (int16_t)(w - 2 * padding), row_h));
  text_layer_set_background_color(s_date_layer, GColorClear);
  text_layer_set_text_color(s_date_layer, s_wd_color);
  text_layer_set_font(s_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text_alignment(s_date_layer, wd_align);
  layer_add_child(root, text_layer_get_layer(s_date_layer));
#endif

  prv_apply_config();

  // Display current time immediately
  time_t now = time(NULL);
  struct tm *tick_time = localtime(&now);
  prv_set_time(tick_time);
  // Snap digits to final state without animation on load
  for (int i = 0; i < NUM_DIGITS; i++) {
    s_digits[i].current = s_digits[i].next;
    s_digits[i].offset  = 0;
  }
  if (s_anim) {
    animation_unschedule(s_anim);
    s_anim = NULL;
  }
  for (int i = 0; i < NUM_DIGITS; i++) layer_mark_dirty(s_digit_layer[i]);

#ifndef PBL_PLATFORM_APLITE
  prv_update_date_display(tick_time);
#endif
}

static void prv_window_unload(Window *window) {
  (void)window;

  if (s_anim) {
    animation_unschedule(s_anim);
    s_anim = NULL;
  }
  for (int i = 0; i < NUM_DIGITS; i++) {
    layer_destroy(s_digit_layer[i]);
    s_digit_layer[i] = NULL;
  }
  layer_destroy(s_colon_layer);
  s_colon_layer = NULL;

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
  s_weather_valid = false;
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

