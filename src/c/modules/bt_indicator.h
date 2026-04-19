#pragma once

#include <pebble.h>

void bt_indicator_create(Window *window);
void bt_indicator_destroy(void);
void bt_indicator_set_status(bool connected);
