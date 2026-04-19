'use strict';

jest.mock('../../src/pkjs/weather');
jest.mock('@rebble/clay', function () {
  return jest.fn().mockImplementation(function () { return {}; });
});

require('../mocks/pebble');
var weather = require('../../src/pkjs/weather');
var mk      = require('../../build/js/message_keys.json');

// Load index.js — registers all Pebble event listeners synchronously.
require('../../src/pkjs/index');

// Capture handlers immediately, before any jest.clearAllMocks() calls.
var _handlers = {};
['ready', 'appmessage'].forEach(function (name) {
  var call = Pebble.addEventListener.mock.calls.find(function (c) { return c[0] === name; });
  if (call) _handlers[name] = call[1];
});

beforeEach(function () {
  global.localStorage._reset();
  jest.clearAllMocks();
  // Restore default watch platform after clearAllMocks resets call history.
  global.Pebble.getActiveWatchInfo.mockReturnValue({ platform: 'basalt' });
});

// ============================================================
// Event listener registration
// ============================================================

describe('event listener registration', function () {
  test('registers ready handler', function () {
    expect(_handlers.ready).toBeDefined();
  });

  test('registers appmessage handler', function () {
    expect(_handlers.appmessage).toBeDefined();
  });
});

// ============================================================
// ready
// ============================================================

describe('ready', function () {
  test('sends JS_READY message to watchapp', function () {
    _handlers.ready();
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.JS_READY]).toBe(1);
  });
});

// ============================================================
// appmessage
// ============================================================

describe('appmessage', function () {
  test('calls weather.getWeather when GET_WEATHER key is present', function () {
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    expect(weather.getWeather).toHaveBeenCalledTimes(1);
  });

  test('does not call weather.getWeather when GET_WEATHER is absent', function () {
    _handlers.appmessage({ payload: {} });
    expect(weather.getWeather).not.toHaveBeenCalled();
  });

  test('passes GPS flag and location from payload to weather.getWeather', function () {
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    payload[mk.WEATHER_USE_GPS] = 1;
    payload[mk.WEATHER_LOCATION] = 'Paris';
    _handlers.appmessage({ payload: payload });
    var args = weather.getWeather.mock.calls[0][0];
    expect(args.useGPS).toBe(1);
    expect(args.location).toBe('Paris');
  });

  test('passes stored API key to weather.getWeather', function () {
    global.localStorage.setItem('sliding_weather_owm_api_key', 'stored-key');
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    var args = weather.getWeather.mock.calls[0][0];
    expect(args.apiKey).toBe('stored-key');
  });

  test('sends current weather data to watch via AppMessage', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb(null, { tempF: 72, tempC: 22, conditions: 'Clouds', conditionCode: 804 }, null);
    });
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.TEMPERATURE]).toBe(72);
    expect(msg[mk.TEMPERATURE_IN_C]).toBe(22);
    expect(msg[mk.CONDITIONS]).toBe('Clouds');
    expect(msg[mk.CONDITION_CODE]).toBe(804);
    // No forecast data — hi/lo keys should be absent
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE_LO));
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE_HI));
  });

  test('includes hi/lo forecast data in AppMessage when available', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb(
        null,
        { tempF: 72, tempC: 22, conditions: 'Clouds', conditionCode: 804 },
        { loF: 55, hiF: 80, loC: 13, hiC: 27 }
      );
    });
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.TEMPERATURE_LO]).toBe(55);
    expect(msg[mk.TEMPERATURE_HI]).toBe(80);
    expect(msg[mk.TEMPERATURE_IN_C_LO]).toBe(13);
    expect(msg[mk.TEMPERATURE_IN_C_HI]).toBe(27);
  });

  test('sends error status to watch when weather fetch fails with No API Key', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'No API Key' });
    });
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe('No API Key');
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test('sends error status to watch when weather fetch fails with Invalid API Key', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'Invalid API Key' });
    });
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe('Invalid API Key');
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test('sends error status to watch when weather fetch fails with Network Error', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'Network Error' });
    });
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe('Network Error');
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test('sends error status to watch when weather fetch fails with No Location', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'No Location' });
    });
    var payload = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe('No Location');
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  // Real hardware delivers payload keys as string names, not numeric IDs.
  test('handles string-keyed payload from real hardware', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb(null, { tempF: 72, tempC: 22, conditions: 'Clear', conditionCode: 800 }, null);
    });
    _handlers.appmessage({ payload: { GET_WEATHER: 1, WEATHER_USE_GPS: 0, WEATHER_LOCATION: 'London' } });
    expect(weather.getWeather).toHaveBeenCalledTimes(1);
    var args = weather.getWeather.mock.calls[0][0];
    expect(args.useGPS).toBe(0);
    expect(args.location).toBe('London');
  });

  test('ignores string-keyed payload without GET_WEATHER', function () {
    _handlers.appmessage({ payload: { SOME_OTHER_KEY: 1 } });
    expect(weather.getWeather).not.toHaveBeenCalled();
  });
});
