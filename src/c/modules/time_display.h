#pragma once

#include <pebble.h>

#define NUM_TIME_LINES     3
#define TIME_WORD_MAXLEN   16
#define LINE_H             49
#define LINE_GAP           -15

void time_display_create(Window *window, int16_t start_y, int16_t padding);
void time_display_destroy(void);
void time_display_set_time(struct tm *tick_time);
void time_display_apply_config(void);
void time_display_snap_to_time(struct tm *tick_time);
void time_display_relayout(int16_t start_y, int16_t padding);
