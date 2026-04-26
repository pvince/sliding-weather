#include "time_display.h"
#include "config.h"

#define SLIDE_DURATION_MS  800

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
  "ten", "eleven", "twelve", "thirteen", "four\nteen",
  "fifteen", "sixteen", "seven\nteen", "eight\nteen", "nine\nteen"
};
static const char *s_tens[] = {
  "", "", "twenty", "thirty", "forty", "fifty"
};

// ============================================================
// Module state
// ============================================================

static Window              *s_window;
static TextLayer           *s_time_layer[NUM_TIME_LINES];
static char                 s_time_text[NUM_TIME_LINES][TIME_WORD_MAXLEN];
static PropertyAnimation   *s_line_anim[NUM_TIME_LINES];
static GRect                s_line_target[NUM_TIME_LINES];
static int16_t              s_padding;

// ============================================================
// Helpers
// ============================================================

// Adjust a minute-line layout for long words (>= 8 chars).  Short words use
// the default padded width; long words (e.g. teens like "thirteen") get full
// screen width so they fit in FONT_KEY_BITHAM_42_LIGHT.  Words containing a
// newline (e.g. "seven\nteen") also get double height for the wrapped line.
static void prv_adjust_line_for_text(int idx, const char *text) {
  Layer *root = window_get_root_layer(s_window);
  GRect bounds = layer_get_unobstructed_bounds(root);

  if (strlen(text) >= 8) {
    s_line_target[idx].origin.x = 0;
    s_line_target[idx].size.w   = bounds.size.w;
  } else {
    s_line_target[idx].origin.x = s_padding;
    s_line_target[idx].size.w   = bounds.size.w - 2 * s_padding;
  }
  s_line_target[idx].size.h = strchr(text, '\n') ? LINE_H * 2 : LINE_H;
  text_layer_set_font(s_time_layer[idx],
                      fonts_get_system_font(FONT_KEY_BITHAM_42_LIGHT));
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

  // Use full bounds (not unobstructed) so the slide starts from the physical
  // screen edge — the text should appear to fly in from off-screen.
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
// Public interface
// ============================================================

void time_display_create(Window *window, int16_t start_y, int16_t padding) {
  s_window = window;
  s_padding = padding;
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_unobstructed_bounds(root);
  int16_t w = bounds.size.w;

  GFont hr_font  = fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
  GFont min_font = fonts_get_system_font(FONT_KEY_BITHAM_42_LIGHT);
  GTextAlignment time_align = GTextAlignmentLeft;
  for (int i = 0; i < NUM_TIME_LINES; i++) {
    int16_t ly = start_y + i * (LINE_H + LINE_GAP);
    s_line_target[i] = GRect(padding, ly, w - 2 * padding, LINE_H);
    s_time_layer[i] = text_layer_create(s_line_target[i]);
    text_layer_set_background_color(s_time_layer[i], GColorClear);
    text_layer_set_text_color(s_time_layer[i], (i == 0) ? config_get_hr_color() : config_get_min_color());
    text_layer_set_font(s_time_layer[i], (i == 0) ? hr_font : min_font);
    text_layer_set_text_alignment(s_time_layer[i], time_align);
    layer_add_child(root, text_layer_get_layer(s_time_layer[i]));
    s_time_text[i][0] = '\0';
    s_line_anim[i] = NULL;
  }
}

void time_display_destroy(void) {
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
}

void time_display_set_time(struct tm *tick_time) {
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
        prv_adjust_line_for_text(i, s_time_text[i]);
      }
      text_layer_set_text(s_time_layer[i], s_time_text[i]);
      prv_slide_in_line(i);
    }
  }
}

void time_display_apply_config(void) {
  GTextAlignment time_align = GTextAlignmentLeft;
  for (int i = 0; i < NUM_TIME_LINES; i++) {
    text_layer_set_text_color(s_time_layer[i], (i == 0) ? config_get_hr_color() : config_get_min_color());
    text_layer_set_text_alignment(s_time_layer[i], time_align);
  }
}

void time_display_snap_to_time(struct tm *tick_time) {
  int hour = tick_time->tm_hour % 12;
  if (hour == 0) hour = 12;

  char init_text[NUM_TIME_LINES][TIME_WORD_MAXLEN];
  prv_compute_time_words(hour, tick_time->tm_min, init_text);

  for (int i = 0; i < NUM_TIME_LINES; i++) {
    strncpy(s_time_text[i], init_text[i], TIME_WORD_MAXLEN - 1);
    s_time_text[i][TIME_WORD_MAXLEN - 1] = '\0';
    if (i > 0 && s_time_text[i][0] != '\0') {
      prv_adjust_line_for_text(i, s_time_text[i]);
      layer_set_frame(text_layer_get_layer(s_time_layer[i]), s_line_target[i]);
    }
    text_layer_set_text(s_time_layer[i], s_time_text[i]);
    if (s_time_text[i][0] == '\0') {
      layer_set_hidden(text_layer_get_layer(s_time_layer[i]), true);
    }
  }
}

void time_display_relayout(int16_t start_y, int16_t padding) {
  s_padding = padding;
  Layer *root = window_get_root_layer(s_window);
  GRect bounds = layer_get_unobstructed_bounds(root);
  int16_t w = bounds.size.w;

  for (int i = 0; i < NUM_TIME_LINES; i++) {
    int16_t ly = start_y + i * (LINE_H + LINE_GAP);
    s_line_target[i].origin.y = ly;
    // Re-adjust width for current text (long words get full width)
    if (i > 0 && s_time_text[i][0] != '\0') {
      prv_adjust_line_for_text(i, s_time_text[i]);
    } else {
      s_line_target[i].origin.x = s_padding;
      s_line_target[i].size.w = w - 2 * s_padding;
    }
    layer_set_frame(text_layer_get_layer(s_time_layer[i]), s_line_target[i]);
  }
}
