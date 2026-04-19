#include "bt_indicator.h"
#include "config.h"

#define BT_SYMBOL "X"

#define BT_ICON_SIZE 20

// ============================================================
// Module state
// ============================================================

static TextLayer *s_bt_layer;

// ============================================================
// Public interface
// ============================================================

void bt_indicator_create(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_unobstructed_bounds(root);

  int16_t x = (int16_t)(bounds.size.w - BT_ICON_SIZE - PBL_IF_ROUND_ELSE(20, 4));
  int16_t y = PBL_IF_ROUND_ELSE(12, 2);

  s_bt_layer = text_layer_create(GRect(x, y, BT_ICON_SIZE, BT_ICON_SIZE));
  text_layer_set_background_color(s_bt_layer, GColorClear);
  text_layer_set_text_color(s_bt_layer, config_get_wd_color());
  text_layer_set_font(s_bt_layer,
                      fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(s_bt_layer, GTextAlignmentCenter);
  text_layer_set_text(s_bt_layer, BT_SYMBOL);

  // Start hidden; will show when BT disconnects
  layer_set_hidden(text_layer_get_layer(s_bt_layer),
                   connection_service_peek_pebble_app_connection());

  layer_add_child(root, text_layer_get_layer(s_bt_layer));
}

void bt_indicator_destroy(void) {
  text_layer_destroy(s_bt_layer);
  s_bt_layer = NULL;
}

void bt_indicator_set_status(bool connected) {
  if (s_bt_layer) {
    layer_set_hidden(text_layer_get_layer(s_bt_layer), connected);
  }
}
