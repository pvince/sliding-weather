'use strict';

jest.mock('../../src/pkjs/weather');
jest.mock('@rebble/clay', function () {
  return jest.fn().mockImplementation(function () { return {}; });
});

require('../mocks/pebble');
var weather = require('../../src/pkjs/weather');

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
    expect(msg[10024]).toBe(1); // JS_READY = 10024
  });
});

// ============================================================
// appmessage
// ============================================================

describe('appmessage', function () {
  test('calls weather.getWeather when GET_WEATHER key is present', function () {
    _handlers.appmessage({ payload: { 10011: 1 } }); // GET_WEATHER = 10011
    expect(weather.getWeather).toHaveBeenCalledTimes(1);
  });

  test('does not call weather.getWeather when GET_WEATHER is absent', function () {
    _handlers.appmessage({ payload: {} });
    expect(weather.getWeather).not.toHaveBeenCalled();
  });

  test('passes GPS flag and location from payload to weather.getWeather', function () {
    // WEATHER_USE_GPS = 10022, WEATHER_LOCATION = 10023
    _handlers.appmessage({ payload: { 10011: 1, 10022: 1, 10023: 'Paris' } });
    var args = weather.getWeather.mock.calls[0][0];
    expect(args.useGPS).toBe(1);
    expect(args.location).toBe('Paris');
  });

  test('passes stored API key to weather.getWeather', function () {
    global.localStorage.setItem('sliding_weather_owm_api_key', 'stored-key');
    _handlers.appmessage({ payload: { 10011: 1 } });
    var args = weather.getWeather.mock.calls[0][0];
    expect(args.apiKey).toBe('stored-key');
  });

  test('sends current weather data to watch via AppMessage', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb(null, { tempF: 72, tempC: 22, conditions: 'Clouds', conditionCode: 804 }, null);
    });
    _handlers.appmessage({ payload: { 10011: 1 } });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[10012]).toBe(72);       // TEMPERATURE
    expect(msg[10000]).toBe(22);       // TEMPERATURE_IN_C
    expect(msg[10001]).toBe('Clouds'); // CONDITIONS
    expect(msg[10019]).toBe(804);      // CONDITION_CODE
    // No forecast data — hi/lo keys should be absent
    expect(msg).not.toHaveProperty('10015'); // TEMPERATURE_LO
    expect(msg).not.toHaveProperty('10016'); // TEMPERATURE_HI
  });

  test('includes hi/lo forecast data in AppMessage when available', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb(
        null,
        { tempF: 72, tempC: 22, conditions: 'Clouds', conditionCode: 804 },
        { loF: 55, hiF: 80, loC: 13, hiC: 27 }
      );
    });
    _handlers.appmessage({ payload: { 10011: 1 } });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[10015]).toBe(55); // TEMPERATURE_LO
    expect(msg[10016]).toBe(80); // TEMPERATURE_HI
    expect(msg[10017]).toBe(13); // TEMPERATURE_IN_C_LO
    expect(msg[10018]).toBe(27); // TEMPERATURE_IN_C_HI
  });

  test('sends error status to watch when weather fetch fails with No API Key', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'No API Key' });
    });
    _handlers.appmessage({ payload: { 10011: 1 } });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[10001]).toBe('No API Key'); // CONDITIONS
    expect(msg).not.toHaveProperty('10012'); // No TEMPERATURE
  });

  test('sends error status to watch when weather fetch fails with Invalid API Key', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'Invalid API Key' });
    });
    _handlers.appmessage({ payload: { 10011: 1 } });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[10001]).toBe('Invalid API Key');
    expect(msg).not.toHaveProperty('10012');
  });

  test('sends error status to watch when weather fetch fails with Network Error', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'Network Error' });
    });
    _handlers.appmessage({ payload: { 10011: 1 } });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[10001]).toBe('Network Error');
    expect(msg).not.toHaveProperty('10012');
  });

  test('sends error status to watch when weather fetch fails with No Location', function () {
    weather.getWeather.mockImplementation(function (opts, cb) {
      cb({ message: 'No Location' });
    });
    _handlers.appmessage({ payload: { 10011: 1 } });
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(msg[10001]).toBe('No Location');
    expect(msg).not.toHaveProperty('10012');
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
