import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import * as weather from "../../src/pkjs/weather";
import { MockXHR } from "../mocks/pebble";

// Restore any spies left over from other test files (e.g. index.test.ts spyOn)
if (typeof (weather.getWeather as any).mockRestore === "function") {
  (weather.getWeather as any).mockRestore();
}

describe("kelvinToF", () => {
  test("freezing point 273.15K → 32°F", () => {
    expect(weather.kelvinToF(273.15)).toBe(32);
  });

  test("boiling point 373.15K → 212°F", () => {
    expect(weather.kelvinToF(373.15)).toBe(212);
  });

  test("body temperature 310.15K → 98°F", () => {
    expect(weather.kelvinToF(310.15)).toBe(99);
  });

  test("below freezing 263.15K → 14°F", () => {
    expect(weather.kelvinToF(263.15)).toBe(14);
  });

  test("rounds to nearest integer", () => {
    expect(weather.kelvinToF(274)).toBe(34);
  });
});

describe("kelvinToC", () => {
  test("273.15K → 0°C", () => {
    expect(weather.kelvinToC(273.15)).toBe(0);
  });

  test("373.15K → 100°C", () => {
    expect(weather.kelvinToC(373.15)).toBe(100);
  });

  test("253.15K → -20°C", () => {
    expect(weather.kelvinToC(253.15)).toBe(-20);
  });

  test("rounds to nearest integer", () => {
    expect(weather.kelvinToC(274)).toBe(1);
  });
});

describe("buildCurrentWeatherUrl", () => {
  test("uses lat/lon when provided", () => {
    const url = weather.buildCurrentWeatherUrl({
      lat: 51.5,
      lon: -0.1,
      apiKey: "TESTKEY",
    });
    expect(url).toContain("lat=51.5");
    expect(url).toContain("lon=-0.1");
    expect(url).toContain("appid=TESTKEY");
    expect(url).toContain("/weather?");
  });

  test("uses q= for static location", () => {
    const url = weather.buildCurrentWeatherUrl({
      location: "London, UK",
      apiKey: "TESTKEY",
    });
    expect(url).toContain("q=London%2C%20UK");
    expect(url).toContain("appid=TESTKEY");
  });

  test("URL-encodes special characters in location", () => {
    const url = weather.buildCurrentWeatherUrl({
      location: "São Paulo",
      apiKey: "KEY",
    });
    expect(url).not.toContain("São Paulo");
    expect(url).toContain("appid=KEY");
  });
});

describe("parseCurrentWeather", () => {
  const validResponse = {
    main: { temp: 293.15 },
    weather: [{ main: "Clear", id: 800 }],
  };

  test("parses valid response", () => {
    const result = weather.parseCurrentWeather(validResponse);
    expect(result).not.toBeNull();
    expect(result?.tempF).toBe(68);
    expect(result?.tempC).toBe(20);
    expect(result?.conditions).toBe("Clear");
    expect(result?.conditionCode).toBe(800);
  });

  test("returns null for null input", () => {
    expect(weather.parseCurrentWeather(null)).toBeNull();
  });

  test("returns null when main is missing", () => {
    expect(
      weather.parseCurrentWeather({ weather: [{ main: "Clear" }] }),
    ).toBeNull();
  });

  test("returns null when weather array is empty", () => {
    expect(
      weather.parseCurrentWeather({ main: { temp: 300 }, weather: [] }),
    ).toBeNull();
  });

  test("returns null for completely empty object", () => {
    expect(weather.parseCurrentWeather({})).toBeNull();
  });

  test("handles missing condition code gracefully", () => {
    const r = weather.parseCurrentWeather({
      main: { temp: 300 },
      weather: [{ main: "Rain" }],
    });
    expect(r).not.toBeNull();
    expect(r?.conditionCode).toBe(0);
  });
});

describe("getWeather", () => {
  beforeEach(() => {
    MockXHR.reset();
    mock.clearAllMocks();
  });

  test("calls back with No API Key error when apiKey is empty", () => {
    const callback = jest.fn();
    weather.getWeather({ apiKey: "", useGPS: 0, location: "Paris" }, callback);
    expect(MockXHR._instances.length).toBe(0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "No API Key" });
  });

  test("calls back with No API Key error when apiKey is missing", () => {
    const callback = jest.fn();
    weather.getWeather({ apiKey: "", useGPS: 0, location: "Paris" }, callback);
    expect(MockXHR._instances.length).toBe(0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "No API Key" });
  });

  test("uses static location when useGPS=0", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "KEY", useGPS: 0, location: "Tokyo" },
      callback,
    );
    expect(MockXHR._instances.length).toBeGreaterThan(0);
    const openCall = (MockXHR.prototype as any).open.mock.calls[0];
    expect(openCall[1]).toContain("Tokyo");
    expect(openCall[1]).not.toContain("lat=");
  });

  test("uses GPS when useGPS=1", () => {
    const callback = jest.fn();
    weather.getWeather({ apiKey: "KEY", useGPS: 1 }, callback);
    expect(
      (globalThis as any).navigator.geolocation.getCurrentPosition,
    ).toHaveBeenCalled();
    expect(MockXHR._instances.length).toBe(0);
  });

  test("falls back to static location when GPS fails", () => {
    const callback = jest.fn();
    (
      globalThis as any
    ).navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      (success: any, error: any) => {
        error({ message: "GPS denied" });
      },
    );
    weather.getWeather(
      { apiKey: "KEY", useGPS: 1, location: "Berlin" },
      callback,
    );
    expect(MockXHR._instances.length).toBeGreaterThan(0);
    const openCall = (MockXHR.prototype as any).open.mock.calls[0];
    expect(openCall[1]).toContain("Berlin");
  });

  test("calls onComplete with parsed data after successful GPS + XHR", () => {
    const callback = jest.fn();
    const mockCoords = { coords: { latitude: 48.8, longitude: 2.35 } };
    (
      globalThis as any
    ).navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      (success: any) => {
        success(mockCoords);
      },
    );

    weather.getWeather({ apiKey: "KEY", useGPS: 1 }, callback);

    MockXHR.respond(
      {
        main: { temp: 293.15 },
        weather: [{ main: "Clouds", id: 803 }],
      },
      0,
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeNull();
    const current = callback.mock.calls[0][1];
    expect(current.tempC).toBe(20);
    expect(current.conditions).toBe("Clouds");
  });

  test("calls back with Invalid API Key on 401 response", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "BAD", useGPS: 0, location: "London" },
      callback,
    );
    MockXHR.respond({ cod: 401, message: "Invalid API key" }, 0, 401);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "Invalid API Key" });
  });

  test("calls back with API Rate Limit on 429 response", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "KEY", useGPS: 0, location: "London" },
      callback,
    );
    MockXHR.respond({ cod: 429, message: "Too many requests" }, 0, 429);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "API Rate Limit" });
  });

  test("calls back with Weather Error on non-200 response", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "KEY", useGPS: 0, location: "London" },
      callback,
    );
    MockXHR.respond({ cod: 500 }, 0, 500);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "Weather Error" });
  });

  test("calls back with Network Error on XHR failure", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "KEY", useGPS: 0, location: "London" },
      callback,
    );
    MockXHR.fail(0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "Network Error" });
  });

  test("calls back with Weather Error on unexpected response structure", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "KEY", useGPS: 0, location: "London" },
      callback,
    );
    MockXHR.respond({ unexpected: "data" }, 0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "Weather Error" });
  });

  test("calls back with No Location when GPS fails and no static location", () => {
    const callback = jest.fn();
    (
      globalThis as any
    ).navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      (success: any, error: any) => {
        error({ message: "GPS denied" });
      },
    );
    weather.getWeather({ apiKey: "KEY", useGPS: 1 }, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "No Location" });
  });

  test("calls back with No Location when GPS fallback fails with no location", () => {
    const callback = jest.fn();
    (
      globalThis as any
    ).navigator.geolocation.getCurrentPosition.mockImplementationOnce(
      (success: any, error: any) => {
        error({ message: "GPS denied" });
      },
    );
    weather.getWeather({ apiKey: "KEY", useGPS: 0 }, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toEqual({ message: "No Location" });
  });

  test("parses weather when xhr.status is 0 (PebbleKit JS proxy)", () => {
    const callback = jest.fn();
    weather.getWeather(
      { apiKey: "KEY", useGPS: 0, location: "London" },
      callback,
    );

    const xhr = MockXHR._instances[0];
    xhr.responseText = JSON.stringify({
      main: { temp: 293.15 },
      weather: [{ main: "Clear", id: 800 }],
    });
    xhr.onload?.();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeNull();
    expect(callback.mock.calls[0][1].tempC).toBe(20);
    expect(callback.mock.calls[0][1].conditions).toBe("Clear");
  });
});
