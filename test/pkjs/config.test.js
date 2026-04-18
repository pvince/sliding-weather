'use strict';

require('../mocks/pebble');
var cfg = require('../../src/pkjs/config');

beforeEach(function () {
  global.localStorage._reset();
  jest.clearAllMocks();
});

// ============================================================
// parseColor
// ============================================================

describe('parseColor', function () {
  test('parses 6-char hex string', function () {
    expect(cfg.parseColor('ffffff')).toBe(0xFFFFFF);
    expect(cfg.parseColor('000000')).toBe(0);
    expect(cfg.parseColor('ff0000')).toBe(0xFF0000);
  });

  test('parses hex string with # prefix', function () {
    expect(cfg.parseColor('#1a2b3c')).toBe(0x1A2B3C);
  });

  test('strips leading 2-char alpha from 8-char ARGB', function () {
    expect(cfg.parseColor('ff123456')).toBe(0x123456);
    expect(cfg.parseColor('00ffffff')).toBe(0xFFFFFF);
  });

  test('returns 0 for invalid input', function () {
    expect(cfg.parseColor('zzzzzz')).toBe(0);
    expect(cfg.parseColor('')).toBe(0);
  });
});

// ============================================================
// parseConfigResponse
// ============================================================

describe('parseConfigResponse', function () {
  test('parses all fields correctly', function () {
    var raw = {
      backgroundColor:      'ff0000',
      hrColor:              '00ff00',
      minColor:             '0000ff',
      wdColor:              'ffff00',
      weatherFrequency:     '30',
      useGPS:               '1',
      weatherLocation:      'Paris, FR',
      shakeForLoHi:         '1',
      useCelsius:           '1',
      displayPrefix:        '0',
      displayDate:          '1',
      weatherDateAlignment: '2',
      hourMinutesAlignment: '1',
      weatherDateReadability: '3',
      minutesReadability:   '0',
      vibrateBT:            '0'
    };

    var result = cfg.parseConfigResponse(raw);

    expect(result.backgroundColor).toBe(0xFF0000);
    expect(result.hrColor).toBe(0x00FF00);
    expect(result.minColor).toBe(0x0000FF);
    expect(result.wdColor).toBe(0xFFFF00);
    expect(result.weatherFrequency).toBe(30);
    expect(result.useGPS).toBe(1);
    expect(result.weatherLocation).toBe('Paris, FR');
    expect(result.shakeForLoHi).toBe(1);
    expect(result.useCelsius).toBe(1);
    expect(result.displayPrefix).toBe(0);
    expect(result.displayDate).toBe(1);
    expect(result.weatherDateAlignment).toBe(2);
    expect(result.hourMinutesAlignment).toBe(1);
    expect(result.weatherDateReadability).toBe(3);
    expect(result.vibrateBT).toBe(0);
  });

  test('returns empty object for null/undefined', function () {
    expect(cfg.parseConfigResponse(null)).toEqual({});
    expect(cfg.parseConfigResponse(undefined)).toEqual({});
  });

  test('fills missing fields with defaults', function () {
    var result = cfg.parseConfigResponse({});
    // Defaults should be applied — colors parsed as numbers
    expect(typeof result.backgroundColor).toBe('number');
    expect(result.weatherFrequency).toBe(30);
    expect(result.useGPS).toBe(1);
    expect(result.vibrateBT).toBe(1);
  });

  test('colors survive integer round-trip', function () {
    var raw = { backgroundColor: 'aabbcc' };
    var result = cfg.parseConfigResponse(raw);
    expect(result.backgroundColor).toBe(0xAABBCC);
    // Re-parse the same numeric value as string
    var raw2 = { backgroundColor: result.backgroundColor.toString(16) };
    expect(cfg.parseConfigResponse(raw2).backgroundColor).toBe(0xAABBCC);
  });
});

// ============================================================
// buildAppMessage
// ============================================================

describe('buildAppMessage', function () {
  var mockKeys = {
    BACKGROUND_COLOR:       3,
    HR_COLOR:              28,
    MIN_COLOR:             29,
    WD_COLOR:              26,
    WEATHER_FREQUENCY:      5,
    WEATHER_USE_GPS:       23,
    WEATHER_LOCATION:      24,
    SHAKE_FOR_LOHI:        21,
    USE_CELSIUS:            6,
    DISPLAY_O_PREFIX:       7,
    DISPLAY_DATE:          27,
    WEATHERDATE_ALIGNMENT: 10,
    HOURMINUTES_ALIGNMENT: 11,
    WEATHERDATE_READABILITY: 14,
    VIBBRATE_BT_STATUS:    22
  };

  test('maps parsed config to numeric message keys', function () {
    var parsed = cfg.parseConfigResponse({
      backgroundColor: 'ff0000',
      hrColor: 'ffffff',
      weatherFrequency: '60',
      useGPS: '0',
      weatherLocation: 'Berlin',
      useCelsius: '1',
      vibrateBT: '1'
    });

    var msg = cfg.buildAppMessage(parsed, mockKeys);

    expect(msg[3]).toBe(0xFF0000);    // BACKGROUND_COLOR
    expect(msg[28]).toBe(0xFFFFFF);   // HR_COLOR
    expect(msg[5]).toBe(60);          // WEATHER_FREQUENCY
    expect(msg[23]).toBe(0);          // WEATHER_USE_GPS
    expect(msg[24]).toBe('Berlin');   // WEATHER_LOCATION
    expect(msg[6]).toBe(1);           // USE_CELSIUS
    expect(msg[22]).toBe(1);          // VIBBRATE_BT_STATUS
  });

  test('includes all expected keys', function () {
    var parsed = cfg.parseConfigResponse({});
    var msg = cfg.buildAppMessage(parsed, mockKeys);

    var expectedKeyIds = Object.values(mockKeys);
    expectedKeyIds.forEach(function (id) {
      expect(msg).toHaveProperty(String(id));
    });
  });

  test('skips keys not in messageKeys map', function () {
    var parsed = cfg.parseConfigResponse({});
    // Pass a nearly-empty keys map
    var msg = cfg.buildAppMessage(parsed, { BACKGROUND_COLOR: 3 });
    var keys = Object.keys(msg);
    expect(keys).toEqual(['3']);
  });
});

// ============================================================
// getConfigUrl
// ============================================================

describe('getConfigUrl', function () {
  test('returns round URL for chalk platform', function () {
    var url = cfg.getConfigUrl('chalk', {});
    expect(url).toContain('config_round.html');
  });

  test('returns rectangular URL for basalt platform', function () {
    var url = cfg.getConfigUrl('basalt', {});
    expect(url).not.toContain('config_round.html');
  });

  test('returns rectangular URL for unknown platform', function () {
    var url = cfg.getConfigUrl('unknown', {});
    expect(url).not.toContain('config_round.html');
  });

  test('appends stored config as URL hash when config provided', function () {
    var stored = { useCelsius: '1' };
    var url = cfg.getConfigUrl('basalt', stored);
    expect(url).toContain('#');
    var hash = decodeURIComponent(url.split('#')[1]);
    var parsed = JSON.parse(hash);
    expect(parsed.useCelsius).toBe('1');
  });

  test('returns plain URL when stored config is empty', function () {
    var url = cfg.getConfigUrl('basalt', {});
    expect(url).not.toContain('#');
  });
});

// ============================================================
// localStorage helpers
// ============================================================

describe('storeApiKey / getApiKey', function () {
  test('stores and retrieves API key', function () {
    cfg.storeApiKey('MY_SECRET_KEY_123');
    expect(cfg.getApiKey()).toBe('MY_SECRET_KEY_123');
  });

  test('returns empty string when no key stored', function () {
    expect(cfg.getApiKey()).toBe('');
  });

  test('stores empty string when called with falsy', function () {
    cfg.storeApiKey('');
    expect(cfg.getApiKey()).toBe('');
  });
});

describe('storeConfig / loadStoredConfig', function () {
  test('round-trips config object', function () {
    var config = { useCelsius: '1', weatherFrequency: '30', backgroundColor: 'ff0000' };
    cfg.storeConfig(config);
    var loaded = cfg.loadStoredConfig();
    expect(loaded).toEqual(config);
  });

  test('returns empty object when nothing stored', function () {
    expect(cfg.loadStoredConfig()).toEqual({});
  });

  test('returns empty object when stored value is corrupt JSON', function () {
    global.localStorage.getItem.mockReturnValueOnce('{{invalid}}');
    expect(cfg.loadStoredConfig()).toEqual({});
  });
});
