#pragma once

#include <pebble.h>

// Alignment values (match config page)
#define ALIGN_CENTER 0
#define ALIGN_LEFT   1
#define ALIGN_RIGHT  2

// Font readability options for weather/date
#define RDBL_SMALL       0
#define RDBL_SMALL_BOLD  1
#define RDBL_LARGE       2
#define RDBL_LARGE_BOLD  3

void config_init(void);
bool config_handle_inbox(DictionaryIterator *iter);

GColor config_get_bg_color(void);
GColor config_get_hr_color(void);
GColor config_get_min_color(void);
GColor config_get_wd_color(void);

int config_get_weather_frequency(void);
int config_get_use_celsius(void);
int config_get_display_o_prefix(void);
int config_get_display_date(void);
int config_get_shake_for_lohi(void);
int config_get_vibbrate_bt(void);
int config_get_weather_use_gps(void);
int config_get_hourminutes_alignment(void);
int config_get_weatherdate_readability(void);

const char *config_get_weather_location(void);

GColor config_color_from_hex(int hex);
GTextAlignment config_text_alignment(int val);

#if !defined(PBL_PLATFORM_APLITE)
GFont config_weather_bold_font(void);
GFont config_weather_regular_font(void);
int16_t config_weather_row_height(void);
#endif
