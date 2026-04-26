#include "config.h"

// Default config values
#define DEFAULT_BG_COLOR       0x000000
#define DEFAULT_HR_COLOR       0xFFFFFF
#define DEFAULT_MIN_COLOR      0xFFFFFF
#define DEFAULT_WD_COLOR       0xFFFFFF
#define DEFAULT_WEATHER_FREQ   30   // minutes
#define DEFAULT_USE_CELSIUS    0
#define DEFAULT_VIBBRATE_BT    1
#define DEFAULT_WEATHER_GPS    1

#define WEATHER_LOCATION_MAXLEN 64

// ============================================================
// Config state (private)
// ============================================================

static GColor  s_bg_color;
static GColor  s_hr_color;
static GColor  s_min_color;
static GColor  s_wd_color;
static int     s_use_celsius;
static int     s_weather_frequency;   // minutes
static int     s_vibbrate_bt;
static int     s_weather_use_gps;
static char    s_weather_location[WEATHER_LOCATION_MAXLEN];

// ============================================================
// Helpers
// ============================================================

GColor config_color_from_hex(int hex) {
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

// ============================================================
// Init — load persisted config
// ============================================================

void config_init(void) {
  s_bg_color  = config_color_from_hex(persist_exists(MESSAGE_KEY_BACKGROUND_COLOR)
                  ? persist_read_int(MESSAGE_KEY_BACKGROUND_COLOR) : DEFAULT_BG_COLOR);
  s_hr_color  = config_color_from_hex(persist_exists(MESSAGE_KEY_HR_COLOR)
                  ? persist_read_int(MESSAGE_KEY_HR_COLOR)  : DEFAULT_HR_COLOR);
  s_min_color = config_color_from_hex(persist_exists(MESSAGE_KEY_MIN_COLOR)
                  ? persist_read_int(MESSAGE_KEY_MIN_COLOR) : DEFAULT_MIN_COLOR);
  s_wd_color  = config_color_from_hex(persist_exists(MESSAGE_KEY_WD_COLOR)
                  ? persist_read_int(MESSAGE_KEY_WD_COLOR)  : DEFAULT_WD_COLOR);

  s_weather_frequency = persist_exists(MESSAGE_KEY_WEATHER_FREQUENCY)
    ? persist_read_int(MESSAGE_KEY_WEATHER_FREQUENCY) : DEFAULT_WEATHER_FREQ;
  s_use_celsius = persist_exists(MESSAGE_KEY_USE_CELSIUS)
    ? persist_read_int(MESSAGE_KEY_USE_CELSIUS) : DEFAULT_USE_CELSIUS;
  s_vibbrate_bt = persist_exists(MESSAGE_KEY_VIBBRATE_BT_STATUS)
    ? persist_read_int(MESSAGE_KEY_VIBBRATE_BT_STATUS) : DEFAULT_VIBBRATE_BT;
  s_weather_use_gps = persist_exists(MESSAGE_KEY_WEATHER_USE_GPS)
    ? persist_read_int(MESSAGE_KEY_WEATHER_USE_GPS) : DEFAULT_WEATHER_GPS;

  s_weather_location[0] = '\0';
  if (persist_exists(MESSAGE_KEY_WEATHER_LOCATION)) {
    persist_read_string(MESSAGE_KEY_WEATHER_LOCATION,
                        s_weather_location, sizeof(s_weather_location));
  }
}

// ============================================================
// Inbox handler — parse config keys, persist, return true if visual config changed
// ============================================================

bool config_handle_inbox(DictionaryIterator *iter) {
  bool changed = false;

  Tuple *bg_t = dict_find(iter, MESSAGE_KEY_BACKGROUND_COLOR);
  if (bg_t) {
    int hex = (int)bg_t->value->int32;
    persist_write_int(MESSAGE_KEY_BACKGROUND_COLOR, hex);
    s_bg_color = config_color_from_hex(hex);
    changed = true;
  }
  Tuple *hr_t = dict_find(iter, MESSAGE_KEY_HR_COLOR);
  if (hr_t) {
    int hex = (int)hr_t->value->int32;
    persist_write_int(MESSAGE_KEY_HR_COLOR, hex);
    s_hr_color = config_color_from_hex(hex);
    changed = true;
  }
  Tuple *mn_t = dict_find(iter, MESSAGE_KEY_MIN_COLOR);
  if (mn_t) {
    int hex = (int)mn_t->value->int32;
    persist_write_int(MESSAGE_KEY_MIN_COLOR, hex);
    s_min_color = config_color_from_hex(hex);
    changed = true;
  }
  Tuple *wd_t = dict_find(iter, MESSAGE_KEY_WD_COLOR);
  if (wd_t) {
    int hex = (int)wd_t->value->int32;
    persist_write_int(MESSAGE_KEY_WD_COLOR, hex);
    s_wd_color = config_color_from_hex(hex);
    changed = true;
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
    changed = true;
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

  return changed;
}

// ============================================================
// Getters
// ============================================================

GColor config_get_bg_color(void)  { return s_bg_color; }
GColor config_get_hr_color(void)  { return s_hr_color; }
GColor config_get_min_color(void) { return s_min_color; }
GColor config_get_wd_color(void)  { return s_wd_color; }

int config_get_weather_frequency(void) { return s_weather_frequency; }
int config_get_use_celsius(void)       { return s_use_celsius; }
int config_get_vibbrate_bt(void)       { return s_vibbrate_bt; }
int config_get_weather_use_gps(void)   { return s_weather_use_gps; }

const char *config_get_weather_location(void) { return s_weather_location; }

