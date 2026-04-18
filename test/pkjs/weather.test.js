'use strict';

var { MockXHR } = require('../mocks/pebble');
var weather = require('../../src/pkjs/weather');

// ============================================================
// Temperature conversions
// ============================================================

describe('kelvinToF', function () {
  test('freezing point 273.15K → 32°F', function () {
    expect(weather.kelvinToF(273.15)).toBe(32);
  });

  test('boiling point 373.15K → 212°F', function () {
    expect(weather.kelvinToF(373.15)).toBe(212);
  });

  test('body temperature 310.15K → 98°F', function () {
    // 310.15K = 37°C = 98.6°F, rounds to 99
    expect(weather.kelvinToF(310.15)).toBe(99);
  });

  test('below freezing 263.15K → 14°F', function () {
    expect(weather.kelvinToF(263.15)).toBe(14);
  });

  test('rounds to nearest integer', function () {
    // 274K = 33.57°F → rounds to 34
    expect(weather.kelvinToF(274)).toBe(34);
  });
});

describe('kelvinToC', function () {
  test('273.15K → 0°C', function () {
    expect(weather.kelvinToC(273.15)).toBe(0);
  });

  test('373.15K → 100°C', function () {
    expect(weather.kelvinToC(373.15)).toBe(100);
  });

  test('253.15K → -20°C', function () {
    expect(weather.kelvinToC(253.15)).toBe(-20);
  });

  test('rounds to nearest integer', function () {
    // 274K = 0.85°C → rounds to 1
    expect(weather.kelvinToC(274)).toBe(1);
  });
});

// ============================================================
// URL builders
// ============================================================

describe('buildCurrentWeatherUrl', function () {
  test('uses lat/lon when provided', function () {
    var url = weather.buildCurrentWeatherUrl({ lat: 51.5, lon: -0.1, apiKey: 'TESTKEY' });
    expect(url).toContain('lat=51.5');
    expect(url).toContain('lon=-0.1');
    expect(url).toContain('appid=TESTKEY');
    expect(url).toContain('/weather?');
  });

  test('uses q= for static location', function () {
    var url = weather.buildCurrentWeatherUrl({ location: 'London, UK', apiKey: 'TESTKEY' });
    expect(url).toContain('q=London%2C%20UK');
    expect(url).toContain('appid=TESTKEY');
  });

  test('URL-encodes special characters in location', function () {
    var url = weather.buildCurrentWeatherUrl({ location: 'São Paulo', apiKey: 'KEY' });
    expect(url).not.toContain('São Paulo');
    expect(url).toContain('appid=KEY');
  });
});

describe('buildForecastUrl', function () {
  test('uses cnt=1 for daily forecast', function () {
    var url = weather.buildForecastUrl({ lat: 0, lon: 0, apiKey: 'K' });
    expect(url).toContain('cnt=1');
    expect(url).toContain('/forecast/daily?');
  });

  test('uses lat/lon when provided', function () {
    var url = weather.buildForecastUrl({ lat: 40.7, lon: -74.0, apiKey: 'K2' });
    expect(url).toContain('lat=40.7');
    expect(url).toContain('lon=-74');
  });

  test('uses q= for static location', function () {
    var url = weather.buildForecastUrl({ location: 'Berlin', apiKey: 'K3' });
    expect(url).toContain('q=Berlin');
  });
});

// ============================================================
// Response parsers
// ============================================================

describe('parseCurrentWeather', function () {
  var validResponse = {
    main: { temp: 293.15 }, // 20°C / 68°F
    weather: [{ main: 'Clear', id: 800 }]
  };

  test('parses valid response', function () {
    var result = weather.parseCurrentWeather(validResponse);
    expect(result).not.toBeNull();
    expect(result.tempF).toBe(68);
    expect(result.tempC).toBe(20);
    expect(result.conditions).toBe('Clear');
    expect(result.conditionCode).toBe(800);
  });

  test('returns null for null input', function () {
    expect(weather.parseCurrentWeather(null)).toBeNull();
  });

  test('returns null when main is missing', function () {
    expect(weather.parseCurrentWeather({ weather: [{ main: 'Clear' }] })).toBeNull();
  });

  test('returns null when weather array is empty', function () {
    expect(weather.parseCurrentWeather({ main: { temp: 300 }, weather: [] })).toBeNull();
  });

  test('returns null for completely empty object', function () {
    expect(weather.parseCurrentWeather({})).toBeNull();
  });

  test('handles missing condition code gracefully', function () {
    var r = weather.parseCurrentWeather({
      main: { temp: 300 },
      weather: [{ main: 'Rain' }]
    });
    expect(r).not.toBeNull();
    expect(r.conditionCode).toBe(0);
  });
});

describe('parseForecast', function () {
  var validForecast = {
    list: [{ temp: { min: 283.15, max: 303.15 } }] // 10°C/50°F min, 30°C/86°F max
  };

  test('parses valid forecast response', function () {
    var result = weather.parseForecast(validForecast);
    expect(result).not.toBeNull();
    expect(result.loC).toBe(10);
    expect(result.hiC).toBe(30);
    expect(result.loF).toBe(50);
    expect(result.hiF).toBe(86);
  });

  test('returns null for null input', function () {
    expect(weather.parseForecast(null)).toBeNull();
  });

  test('returns null when list is empty', function () {
    expect(weather.parseForecast({ list: [] })).toBeNull();
  });

  test('returns null when temp is missing', function () {
    expect(weather.parseForecast({ list: [{ other: 'data' }] })).toBeNull();
  });
});

// ============================================================
// getWeather — integration (with mocked XHR)
// ============================================================

describe('getWeather', function () {
  beforeEach(function () {
    MockXHR.reset();
    jest.clearAllMocks();
  });

  test('does not make any request when apiKey is empty', function () {
    var callback = jest.fn();
    weather.getWeather({ apiKey: '', useGPS: 0, location: 'Paris' }, callback);
    expect(MockXHR._instances.length).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  test('does not make any request when apiKey is missing', function () {
    var callback = jest.fn();
    weather.getWeather({ useGPS: 0, location: 'Paris' }, callback);
    expect(MockXHR._instances.length).toBe(0);
  });

  test('uses static location when useGPS=0', function () {
    var callback = jest.fn();
    weather.getWeather({ apiKey: 'KEY', useGPS: 0, location: 'Tokyo' }, callback);
    expect(MockXHR._instances.length).toBeGreaterThan(0);
    // Verify location appears in the URL (open() was called on first XHR)
    var openCall = MockXHR.prototype.open.mock.calls[0];
    expect(openCall[1]).toContain('Tokyo');
    expect(openCall[1]).not.toContain('lat=');
  });

  test('uses GPS when useGPS=1', function () {
    var callback = jest.fn();
    weather.getWeather({ apiKey: 'KEY', useGPS: 1 }, callback);
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    expect(MockXHR._instances.length).toBe(0); // XHR not made until GPS resolves
  });

  test('falls back to static location when GPS fails', function () {
    var callback = jest.fn();
    global.navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      function (success, error) { error({ message: 'GPS denied' }); }
    );
    weather.getWeather({ apiKey: 'KEY', useGPS: 1, location: 'Berlin' }, callback);
    expect(MockXHR._instances.length).toBeGreaterThan(0);
    var openCall = MockXHR.prototype.open.mock.calls[0];
    expect(openCall[1]).toContain('Berlin');
  });

  test('calls onComplete with parsed data after successful GPS + XHR', function () {
    var callback = jest.fn();
    var mockCoords = { coords: { latitude: 48.8, longitude: 2.35 } };
    global.navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      function (success) { success(mockCoords); }
    );

    weather.getWeather({ apiKey: 'KEY', useGPS: 1 }, callback);

    // Respond to current weather request (index 0)
    MockXHR.respond({
      main: { temp: 293.15 },
      weather: [{ main: 'Clouds', id: 803 }]
    }, 0);

    // Respond to forecast request (index 1)
    MockXHR.respond({
      list: [{ temp: { min: 283.15, max: 303.15 } }]
    }, 1);

    expect(callback).toHaveBeenCalledTimes(1);
    var [current, forecast] = callback.mock.calls[0];
    expect(current.tempC).toBe(20);
    expect(current.conditions).toBe('Clouds');
    expect(forecast.loC).toBe(10);
    expect(forecast.hiC).toBe(30);
  });

  test('still calls onComplete with null forecast if forecast request fails', function () {
    var callback = jest.fn();
    global.navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      function (success) {
        success({ coords: { latitude: 0, longitude: 0 } });
      }
    );

    weather.getWeather({ apiKey: 'KEY', useGPS: 1 }, callback);
    MockXHR.respond({ main: { temp: 293.15 }, weather: [{ main: 'Clear', id: 800 }] }, 0);
    MockXHR.fail(1); // forecast request fails

    expect(callback).toHaveBeenCalledTimes(1);
    var [, forecast] = callback.mock.calls[0];
    expect(forecast).toBeNull();
  });
});
