'use strict';

require('../mocks/pebble');
var cfg = require('../../src/pkjs/config');

beforeEach(function () {
  global.localStorage._reset();
  jest.clearAllMocks();
});

// ============================================================
// storeApiKey / getApiKey
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

  test('stores empty string when called with null', function () {
    cfg.storeApiKey(null);
    expect(cfg.getApiKey()).toBe('');
  });

  test('overwrites previous key', function () {
    cfg.storeApiKey('first-key');
    cfg.storeApiKey('second-key');
    expect(cfg.getApiKey()).toBe('second-key');
  });
});
