'use strict';

jest.mock('../../src/pkjs/weather');

require('../mocks/pebble');
var weather = require('../../src/pkjs/weather');

// Load index.js — registers all Pebble event listeners synchronously.
require('../../src/pkjs/index');

// Capture handlers immediately, before any jest.clearAllMocks() calls.
var _handlers = {};
['ready', 'appmessage', 'showConfiguration', 'webviewclosed'].forEach(function (name) {
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

  test('registers showConfiguration handler', function () {
    expect(_handlers.showConfiguration).toBeDefined();
  });

  test('registers webviewclosed handler', function () {
    expect(_handlers.webviewclosed).toBeDefined();
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
// showConfiguration
// ============================================================

describe('showConfiguration', function () {
  test('opens rectangular config URL for basalt platform', function () {
    _handlers.showConfiguration();
    expect(Pebble.openURL).toHaveBeenCalledTimes(1);
    var url = Pebble.openURL.mock.calls[0][0];
    expect(url).not.toContain('config_round.html');
    expect(url).toContain('pvince.github.io/sliding-weather/');
  });

  test('opens round config URL for chalk platform', function () {
    global.Pebble.getActiveWatchInfo.mockReturnValue({ platform: 'chalk' });
    _handlers.showConfiguration();
    expect(Pebble.openURL).toHaveBeenCalledTimes(1);
    var url = Pebble.openURL.mock.calls[0][0];
    expect(url).toContain('config_round.html');
  });

  test('opens rectangular config URL for aplite platform', function () {
    global.Pebble.getActiveWatchInfo.mockReturnValue({ platform: 'aplite' });
    _handlers.showConfiguration();
    expect(Pebble.openURL).toHaveBeenCalledTimes(1);
    var url = Pebble.openURL.mock.calls[0][0];
    expect(url).not.toContain('config_round.html');
  });

  test('still opens URL when getActiveWatchInfo throws', function () {
    global.Pebble.getActiveWatchInfo.mockImplementation(function () {
      throw new Error('Not supported');
    });
    _handlers.showConfiguration();
    expect(Pebble.openURL).toHaveBeenCalledTimes(1);
  });

  test('appends stored config as URL hash when config exists', function () {
    global.localStorage.setItem('sliding_weather_config', JSON.stringify({ useCelsius: '1' }));
    _handlers.showConfiguration();
    expect(Pebble.openURL).toHaveBeenCalledTimes(1);
    var url = Pebble.openURL.mock.calls[0][0];
    expect(url).toContain('#');
    var hash = decodeURIComponent(url.split('#')[1]);
    expect(JSON.parse(hash)).toEqual({ useCelsius: '1' });
  });

  test('does not append hash when no stored config', function () {
    _handlers.showConfiguration();
    expect(Pebble.openURL).toHaveBeenCalledTimes(1);
    var url = Pebble.openURL.mock.calls[0][0];
    expect(url).not.toContain('#');
  });
});

// ============================================================
// webviewclosed
// ============================================================

describe('webviewclosed', function () {
  test('sends config to watchface on valid response', function () {
    var response = encodeURIComponent(JSON.stringify({
      backgroundColor: 'ff0000',
      weatherFrequency: '30'
    }));
    _handlers.webviewclosed({ response: response });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
  });

  test('stores API key in localStorage and excludes it from AppMessage', function () {
    var response = encodeURIComponent(JSON.stringify({
      owmApiKey: 'my-secret-key',
      backgroundColor: 'ffffff'
    }));
    _handlers.webviewclosed({ response: response });
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      'sliding_weather_owm_api_key', 'my-secret-key'
    );
    var msg = Pebble.sendAppMessage.mock.calls[0][0];
    expect(Object.values(msg)).not.toContain('my-secret-key');
  });

  test('stores remaining config fields in localStorage', function () {
    var response = encodeURIComponent(JSON.stringify({
      backgroundColor: 'ff0000',
      useCelsius: '1'
    }));
    _handlers.webviewclosed({ response: response });
    var setCall = global.localStorage.setItem.mock.calls.find(function (c) {
      return c[0] === 'sliding_weather_config';
    });
    expect(setCall).toBeDefined();
    var stored = JSON.parse(setCall[1]);
    expect(stored.backgroundColor).toBe('ff0000');
    expect(stored.useCelsius).toBe('1');
  });

  test('does nothing when response is CANCELLED', function () {
    _handlers.webviewclosed({ response: 'CANCELLED' });
    expect(Pebble.sendAppMessage).not.toHaveBeenCalled();
  });

  test('does nothing when response is empty string', function () {
    _handlers.webviewclosed({ response: '' });
    expect(Pebble.sendAppMessage).not.toHaveBeenCalled();
  });

  test('does nothing when event has no response property', function () {
    _handlers.webviewclosed({});
    expect(Pebble.sendAppMessage).not.toHaveBeenCalled();
  });

  test('does nothing when response is invalid JSON', function () {
    _handlers.webviewclosed({ response: encodeURIComponent('not valid json {{{') });
    expect(Pebble.sendAppMessage).not.toHaveBeenCalled();
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
      cb({ tempF: 72, tempC: 22, conditions: 'Clouds', conditionCode: 804 }, null);
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
});
