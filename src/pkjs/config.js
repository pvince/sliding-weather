'use strict';

var STORAGE_KEY_CONFIG  = 'sliding_weather_config';
var STORAGE_KEY_API_KEY = 'sliding_weather_owm_api_key';

// ============================================================
// Config defaults
// ============================================================

var DEFAULTS = {
  backgroundColor:      'ff000000',  // ARGB hex string from config page
  hrColor:              'ffffffff',
  minColor:             'ffffffff',
  wdColor:              'ffffffff',
  weatherFrequency:     '30',
  useGPS:               '1',
  weatherLocation:      '',
  shakeForLoHi:         '0',
  useCelsius:           '0',
  displayPrefix:        '1',
  displayDate:          '1',
  weatherDateAlignment: '0',
  weatherDateReadability: '0',
  minutesReadability:   '0',
  hourMinutesAlignment: '1',
  vibrateBT:            '1'
};

// ============================================================
// Helpers
// ============================================================

/**
 * Parse a color hex string (6 or 8 char, with or without '#') to an int.
 * Strips leading '#' and any alpha prefix, then parses last 6 hex digits.
 */
function parseColor(str) {
  var s = String(str).replace('#', '');
  // Handle 8-char ARGB (e.g., 'ff123456') — keep only RGB
  if (s.length === 8) s = s.slice(2);
  return parseInt(s, 16) || 0;
}

// ============================================================
// Parse config page response
// ============================================================

/**
 * Parse the JSON object returned by the config page webview.
 * Returns a normalized object with typed values.
 */
function parseConfigResponse(raw) {
  var cfg = {};
  if (!raw || typeof raw !== 'object') return cfg;

  cfg.backgroundColor      = parseColor(raw.backgroundColor      || DEFAULTS.backgroundColor);
  cfg.hrColor              = parseColor(raw.hrColor              || DEFAULTS.hrColor);
  cfg.minColor             = parseColor(raw.minColor             || DEFAULTS.minColor);
  cfg.wdColor              = parseColor(raw.wdColor              || DEFAULTS.wdColor);
  cfg.weatherFrequency     = parseInt(raw.weatherFrequency       || DEFAULTS.weatherFrequency, 10);
  cfg.useGPS               = parseInt(raw.useGPS                 || DEFAULTS.useGPS, 10);
  cfg.weatherLocation      = String(raw.weatherLocation          || '');
  cfg.shakeForLoHi         = parseInt(raw.shakeForLoHi           || DEFAULTS.shakeForLoHi, 10);
  cfg.useCelsius           = parseInt(raw.useCelsius             || DEFAULTS.useCelsius, 10);
  cfg.displayPrefix        = parseInt(raw.displayPrefix          || DEFAULTS.displayPrefix, 10);
  cfg.displayDate          = parseInt(raw.displayDate            || DEFAULTS.displayDate, 10);
  cfg.weatherDateAlignment = parseInt(raw.weatherDateAlignment   || DEFAULTS.weatherDateAlignment, 10);
  cfg.hourMinutesAlignment = parseInt(raw.hourMinutesAlignment   || DEFAULTS.hourMinutesAlignment, 10);
  cfg.weatherDateReadability = parseInt(raw.weatherDateReadability || DEFAULTS.weatherDateReadability, 10);
  cfg.minutesReadability   = parseInt(raw.minutesReadability     || DEFAULTS.minutesReadability, 10);
  cfg.vibrateBT            = parseInt(raw.vibrateBT              || DEFAULTS.vibrateBT, 10);

  return cfg;
}

/**
 * Build the AppMessage dictionary to send to the C watchapp.
 * Keys must match the names in package.json messageKeys.
 */
function buildAppMessage(cfg, messageKeys) {
  var msg = {};
  var mk = messageKeys || {};

  if (typeof mk.BACKGROUND_COLOR !== 'undefined')
    msg[mk.BACKGROUND_COLOR] = cfg.backgroundColor;
  if (typeof mk.HR_COLOR !== 'undefined')
    msg[mk.HR_COLOR]         = cfg.hrColor;
  if (typeof mk.MIN_COLOR !== 'undefined')
    msg[mk.MIN_COLOR]        = cfg.minColor;
  if (typeof mk.WD_COLOR !== 'undefined')
    msg[mk.WD_COLOR]         = cfg.wdColor;
  if (typeof mk.WEATHER_FREQUENCY !== 'undefined')
    msg[mk.WEATHER_FREQUENCY]= cfg.weatherFrequency;
  if (typeof mk.WEATHER_USE_GPS !== 'undefined')
    msg[mk.WEATHER_USE_GPS]  = cfg.useGPS;
  if (typeof mk.WEATHER_LOCATION !== 'undefined')
    msg[mk.WEATHER_LOCATION] = cfg.weatherLocation;
  if (typeof mk.SHAKE_FOR_LOHI !== 'undefined')
    msg[mk.SHAKE_FOR_LOHI]   = cfg.shakeForLoHi;
  if (typeof mk.USE_CELSIUS !== 'undefined')
    msg[mk.USE_CELSIUS]      = cfg.useCelsius;
  if (typeof mk.DISPLAY_O_PREFIX !== 'undefined')
    msg[mk.DISPLAY_O_PREFIX] = cfg.displayPrefix;
  if (typeof mk.DISPLAY_DATE !== 'undefined')
    msg[mk.DISPLAY_DATE]     = cfg.displayDate;
  if (typeof mk.WEATHERDATE_ALIGNMENT !== 'undefined')
    msg[mk.WEATHERDATE_ALIGNMENT] = cfg.weatherDateAlignment;
  if (typeof mk.HOURMINUTES_ALIGNMENT !== 'undefined')
    msg[mk.HOURMINUTES_ALIGNMENT] = cfg.hourMinutesAlignment;
  if (typeof mk.WEATHERDATE_READABILITY !== 'undefined')
    msg[mk.WEATHERDATE_READABILITY] = cfg.weatherDateReadability;
  if (typeof mk.VIBBRATE_BT_STATUS !== 'undefined')
    msg[mk.VIBBRATE_BT_STATUS] = cfg.vibrateBT;

  return msg;
}

// ============================================================
// Config URL builder
// ============================================================

var CONFIG_URL_RECT  = 'https://singleserveapps.github.io/sliding-weather/';
var CONFIG_URL_ROUND = 'https://singleserveapps.github.io/sliding-weather/config_round.html';

function getConfigUrl(platform, storedConfig) {
  var base = (platform === 'chalk') ? CONFIG_URL_ROUND : CONFIG_URL_RECT;
  if (storedConfig && typeof storedConfig === 'object' &&
      Object.keys(storedConfig).length > 0) {
    return base + '#' + encodeURIComponent(JSON.stringify(storedConfig));
  }
  return base;
}

// ============================================================
// Persistent storage helpers (localStorage)
// ============================================================

function storeApiKey(key) {
  localStorage.setItem(STORAGE_KEY_API_KEY, key || '');
}

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
}

function storeConfig(raw) {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(raw));
}

function loadStoredConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
  } catch (e) {
    return {};
  }
}

module.exports = {
  DEFAULTS: DEFAULTS,
  parseColor: parseColor,
  parseConfigResponse: parseConfigResponse,
  buildAppMessage: buildAppMessage,
  getConfigUrl: getConfigUrl,
  storeApiKey: storeApiKey,
  getApiKey: getApiKey,
  storeConfig: storeConfig,
  loadStoredConfig: loadStoredConfig
};
