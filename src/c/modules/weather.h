#pragma once

#include <pebble.h>

#if !defined(PBL_PLATFORM_APLITE)

void weather_create(Window *window, int16_t bottom_y, int16_t row_h,
                    int16_t left_w, int16_t right_w,
                    int16_t left_x, int16_t right_x);
void weather_destroy(void);
void weather_apply_config(void);
void weather_load_persisted(void);
void weather_handle_inbox(DictionaryIterator *iter);
void weather_on_js_ready(void);
void weather_update_date(struct tm *tick_time);
void weather_tap_handler(AccelAxisType axis, int32_t direction);
void weather_relayout(int16_t bottom_y, int16_t row_h,
                      int16_t left_w, int16_t right_w,
                      int16_t left_x, int16_t right_x);

#endif
