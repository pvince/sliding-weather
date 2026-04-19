'use strict';

require('../mocks/pebble');

var STORAGE_KEY = 'sliding_weather_owm_api_key';
var customClay = require('../../src/pkjs/custom-clay');

// ============================================================
// Helpers
// ============================================================

function createMockClayConfig() {
  var handlers = {};
  var items = {};

  var clayConfig = {
    EVENTS: {
      AFTER_BUILD: 'AFTER_BUILD',
      BEFORE_DESTROY: 'BEFORE_DESTROY'
    },
    on: jest.fn(function (event, handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    getItemById: jest.fn(function (id) {
      return items[id] || null;
    }),
    _trigger: function (event) {
      (handlers[event] || []).forEach(function (fn) { fn(); });
    },
    _addItem: function (id, item) {
      items[id] = item;
    }
  };

  return clayConfig;
}

function createMockItem(initialValue) {
  var value = initialValue || '';
  return {
    get: jest.fn(function () { return value; }),
    set: jest.fn(function (v) { value = v; })
  };
}

// ============================================================
// Tests
// ============================================================

beforeEach(function () {
  global.localStorage._reset();
  jest.clearAllMocks();
});

describe('custom-clay', function () {
  test('loads stored API key into input on AFTER_BUILD', function () {
    global.localStorage.setItem(STORAGE_KEY, 'my-stored-key');

    var clay = createMockClayConfig();
    var apiKeyItem = createMockItem('');
    clay._addItem('owmApiKey', apiKeyItem);

    customClay.call(clay, {});
    clay._trigger('AFTER_BUILD');

    expect(apiKeyItem.set).toHaveBeenCalledWith('my-stored-key');
  });

  test('does not set value when no stored key exists', function () {
    var clay = createMockClayConfig();
    var apiKeyItem = createMockItem('');
    clay._addItem('owmApiKey', apiKeyItem);

    customClay.call(clay, {});
    clay._trigger('AFTER_BUILD');

    expect(apiKeyItem.set).not.toHaveBeenCalled();
  });

  test('saves API key to localStorage on BEFORE_DESTROY', function () {
    var clay = createMockClayConfig();
    var apiKeyItem = createMockItem('new-api-key');
    clay._addItem('owmApiKey', apiKeyItem);

    customClay.call(clay, {});
    clay._trigger('AFTER_BUILD');
    clay._trigger('BEFORE_DESTROY');

    expect(global.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'new-api-key');
  });

  test('saves empty string when API key input is cleared', function () {
    var clay = createMockClayConfig();
    var apiKeyItem = createMockItem('');
    clay._addItem('owmApiKey', apiKeyItem);

    customClay.call(clay, {});
    clay._trigger('AFTER_BUILD');
    clay._trigger('BEFORE_DESTROY');

    expect(global.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, '');
  });

  test('does nothing when owmApiKey item is not found', function () {
    var clay = createMockClayConfig();
    // No item added for 'owmApiKey'

    customClay.call(clay, {});
    expect(function () {
      clay._trigger('AFTER_BUILD');
    }).not.toThrow();
  });

  test('round-trips API key through store and load', function () {
    // First session: user enters a key
    var clay1 = createMockClayConfig();
    var apiKeyItem1 = createMockItem('round-trip-key');
    clay1._addItem('owmApiKey', apiKeyItem1);

    customClay.call(clay1, {});
    clay1._trigger('AFTER_BUILD');
    clay1._trigger('BEFORE_DESTROY');

    // Second session: key should be loaded from localStorage
    var clay2 = createMockClayConfig();
    var apiKeyItem2 = createMockItem('');
    clay2._addItem('owmApiKey', apiKeyItem2);

    customClay.call(clay2, {});
    clay2._trigger('AFTER_BUILD');

    expect(apiKeyItem2.set).toHaveBeenCalledWith('round-trip-key');
  });
});
