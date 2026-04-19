'use strict';

var clayConfig = require('../../src/pkjs/clay-config');

// ============================================================
// Structure
// ============================================================

describe('clay-config structure', function () {
  test('exports an array', function () {
    expect(Array.isArray(clayConfig)).toBe(true);
  });

  test('has a submit button', function () {
    var submit = clayConfig.find(function (item) { return item.type === 'submit'; });
    expect(submit).toBeDefined();
    expect(submit.defaultValue).toBe('Save');
  });
});

// ============================================================
// Message keys
// ============================================================

describe('clay-config message keys', function () {
  // Collect all messageKey values from the config (including nested section items)
  function collectMessageKeys(config) {
    var keys = [];
    config.forEach(function (item) {
      if (item.messageKey) keys.push(item.messageKey);
      if (item.items) {
        item.items.forEach(function (child) {
          if (child.messageKey) keys.push(child.messageKey);
        });
      }
    });
    return keys;
  }

  var messageKeys = collectMessageKeys(clayConfig);

  test('includes all config-related message keys', function () {
    var expected = [
      'BACKGROUND_COLOR', 'HR_COLOR', 'MIN_COLOR', 'WD_COLOR',
      'WEATHER_USE_GPS', 'WEATHER_LOCATION', 'USE_CELSIUS', 'WEATHER_FREQUENCY',
      'SHAKE_FOR_LOHI', 'DISPLAY_O_PREFIX', 'DISPLAY_DATE', 'VIBBRATE_BT_STATUS',
      'WEATHERDATE_ALIGNMENT', 'HOURMINUTES_ALIGNMENT', 'WEATHERDATE_READABILITY'
    ];
    expected.forEach(function (key) {
      expect(messageKeys).toContain(key);
    });
  });

  test('does not include weather data or internal keys', function () {
    var excluded = [
      'TEMPERATURE', 'TEMPERATURE_IN_C', 'CONDITIONS', 'CONDITION_CODE',
      'TEMPERATURE_LO', 'TEMPERATURE_HI', 'TEMPERATURE_IN_C_LO', 'TEMPERATURE_IN_C_HI',
      'GET_WEATHER', 'JS_READY'
    ];
    excluded.forEach(function (key) {
      expect(messageKeys).not.toContain(key);
    });
  });

  test('has no duplicate message keys', function () {
    var unique = messageKeys.filter(function (v, i, a) { return a.indexOf(v) === i; });
    expect(unique.length).toBe(messageKeys.length);
  });
});

// ============================================================
// Defaults
// ============================================================

describe('clay-config defaults', function () {
  function findItem(config, messageKey) {
    for (var i = 0; i < config.length; i++) {
      var item = config[i];
      if (item.messageKey === messageKey) return item;
      if (item.items) {
        for (var j = 0; j < item.items.length; j++) {
          if (item.items[j].messageKey === messageKey) return item.items[j];
        }
      }
    }
    return null;
  }

  test('BACKGROUND_COLOR defaults to black', function () {
    var item = findItem(clayConfig, 'BACKGROUND_COLOR');
    expect(item.defaultValue).toBe(0x000000);
  });

  test('HR_COLOR defaults to white', function () {
    var item = findItem(clayConfig, 'HR_COLOR');
    expect(item.defaultValue).toBe(0xFFFFFF);
  });

  test('WEATHER_FREQUENCY defaults to 30', function () {
    var item = findItem(clayConfig, 'WEATHER_FREQUENCY');
    expect(item.defaultValue).toBe('30');
  });

  test('WEATHER_USE_GPS defaults to true', function () {
    var item = findItem(clayConfig, 'WEATHER_USE_GPS');
    expect(item.defaultValue).toBe(true);
  });

  test('USE_CELSIUS defaults to Fahrenheit (0)', function () {
    var item = findItem(clayConfig, 'USE_CELSIUS');
    expect(item.defaultValue).toBe('0');
  });

  test('SHAKE_FOR_LOHI defaults to false', function () {
    var item = findItem(clayConfig, 'SHAKE_FOR_LOHI');
    expect(item.defaultValue).toBe(false);
  });

  test('DISPLAY_O_PREFIX defaults to true', function () {
    var item = findItem(clayConfig, 'DISPLAY_O_PREFIX');
    expect(item.defaultValue).toBe(true);
  });

  test('DISPLAY_DATE defaults to true', function () {
    var item = findItem(clayConfig, 'DISPLAY_DATE');
    expect(item.defaultValue).toBe(true);
  });

  test('VIBBRATE_BT_STATUS defaults to true', function () {
    var item = findItem(clayConfig, 'VIBBRATE_BT_STATUS');
    expect(item.defaultValue).toBe(true);
  });

  test('WEATHERDATE_ALIGNMENT defaults to center (0)', function () {
    var item = findItem(clayConfig, 'WEATHERDATE_ALIGNMENT');
    expect(item.defaultValue).toBe('0');
  });

  test('HOURMINUTES_ALIGNMENT defaults to left (1)', function () {
    var item = findItem(clayConfig, 'HOURMINUTES_ALIGNMENT');
    expect(item.defaultValue).toBe('1');
  });

  test('WEATHERDATE_READABILITY defaults to small (0)', function () {
    var item = findItem(clayConfig, 'WEATHERDATE_READABILITY');
    expect(item.defaultValue).toBe('0');
  });
});

// ============================================================
// Platform capabilities
// ============================================================

describe('clay-config capabilities', function () {
  test('layout section is RECT-only', function () {
    var layoutSection = clayConfig.find(function (item) {
      return item.type === 'section' && item.items && item.items.some(function (child) {
        return child.messageKey === 'WEATHERDATE_ALIGNMENT';
      });
    });
    expect(layoutSection).toBeDefined();
    expect(layoutSection.capabilities).toEqual(['RECT']);
  });

  test('colors section requires COLOR capability', function () {
    var colorSection = clayConfig.find(function (item) {
      return item.type === 'section' && item.items && item.items.some(function (child) {
        return child.messageKey === 'BACKGROUND_COLOR';
      });
    });
    expect(colorSection).toBeDefined();
    expect(colorSection.capabilities).toEqual(['COLOR']);
  });
});

// ============================================================
// API key item
// ============================================================

describe('clay-config API key', function () {
  function findById(config, id) {
    for (var i = 0; i < config.length; i++) {
      var item = config[i];
      if (item.id === id) return item;
      if (item.items) {
        for (var j = 0; j < item.items.length; j++) {
          if (item.items[j].id === id) return item.items[j];
        }
      }
    }
    return null;
  }

  test('has an API key input with id but no messageKey', function () {
    var apiKey = findById(clayConfig, 'owmApiKey');
    expect(apiKey).toBeDefined();
    expect(apiKey.type).toBe('input');
    expect(apiKey.messageKey).toBeUndefined();
  });

  test('API key input uses password type', function () {
    var apiKey = findById(clayConfig, 'owmApiKey');
    expect(apiKey.attributes.type).toBe('password');
  });
});
