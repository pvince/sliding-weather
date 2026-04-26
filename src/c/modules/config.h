#pragma once

#include <pebble.h>

void config_init(void);
bool config_handle_inbox(DictionaryIterator *iter);

GColor config_get_bg_color(void);
GColor config_get_hr_color(void);
GColor config_get_min_color(void);
GColor config_get_wd_color(void);

int config_get_weather_frequency(void);
int config_get_use_celsius(void);
int config_get_vibbrate_bt(void);
int config_get_weather_use_gps(void);

const char *config_get_weather_location(void);

GColor config_color_from_hex(int hex);
