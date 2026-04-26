import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from "bun:test";

// Only mock third-party modules that can't be loaded in test env
mock.module("@rebble/clay", () => ({
  default: jest.fn(() => ({})),
}));

// Set up global mocks (Pebble, localStorage, etc.)
require("../mocks/pebble");

// Get the real weather module and spy on getWeather (avoids mock.module leaking to other test files)
const weather = require("../../src/pkjs/weather") as {
  getWeather: ReturnType<typeof jest.fn>;
};
jest.spyOn(weather as any, "getWeather").mockImplementation(jest.fn());
const mk = require("../../build/js/message_keys.json") as Record<
  string,
  number
>;

// Load index.ts — registers all Pebble event listeners synchronously
require("../../src/pkjs/index");

// Capture handlers immediately, before any mock.clearAllMocks() calls
const _handlers: Record<string, (...args: any[]) => any> = {};
["ready", "appmessage"].forEach((name) => {
  const call = (Pebble as any).addEventListener.mock.calls.find(
    (c: any[]) => c[0] === name,
  );
  if (call) _handlers[name] = call[1];
});

beforeEach(() => {
  (globalThis as any).localStorage._reset();
  mock.clearAllMocks();
  (Pebble as any).getActiveWatchInfo.mockReturnValue({ platform: "basalt" });
});

describe("event listener registration", () => {
  test("registers ready handler", () => {
    expect(_handlers.ready).toBeDefined();
  });

  test("registers appmessage handler", () => {
    expect(_handlers.appmessage).toBeDefined();
  });
});

describe("ready", () => {
  test("sends JS_READY message to watchapp", () => {
    _handlers.ready();
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    const msg = (Pebble.sendAppMessage as any).mock.calls[0][0];
    expect(msg[mk.JS_READY]).toBe(1);
  });
});

describe("appmessage", () => {
  test("calls weather.getWeather when GET_WEATHER key is present", () => {
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    expect(weather.getWeather).toHaveBeenCalledTimes(1);
  });

  test("does not call weather.getWeather when GET_WEATHER is absent", () => {
    _handlers.appmessage({ payload: {} });
    expect(weather.getWeather).not.toHaveBeenCalled();
  });

  test("passes GPS flag and location from payload to weather.getWeather", () => {
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    payload[mk.WEATHER_USE_GPS] = 1;
    payload[mk.WEATHER_LOCATION] = "Paris";
    _handlers.appmessage({ payload: payload });
    const args = weather.getWeather.mock.calls[0][0];
    expect(args.useGPS).toBe(1);
    expect(args.location).toBe("Paris");
  });

  test("passes stored API key to weather.getWeather", () => {
    (globalThis as any).localStorage.setItem(
      "sliding_weather_owm_api_key",
      "stored-key",
    );
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    const args = weather.getWeather.mock.calls[0][0];
    expect(args.apiKey).toBe("stored-key");
  });

  test("sends current weather data to watch via AppMessage", () => {
    weather.getWeather.mockImplementation((opts: any, cb: any) => {
      cb(
        null,
        { tempF: 72, tempC: 22, conditions: "Clouds", conditionCode: 804 },
      );
    });
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    const msg = (Pebble.sendAppMessage as any).mock.calls[0][0];
    expect(msg[mk.TEMPERATURE]).toBe(72);
    expect(msg[mk.TEMPERATURE_IN_C]).toBe(22);
    expect(msg[mk.CONDITIONS]).toBe("Clouds");
    expect(msg[mk.CONDITION_CODE]).toBe(804);
  });

  test("sends error status to watch when weather fetch fails with No API Key", () => {
    weather.getWeather.mockImplementation((opts: any, cb: any) => {
      cb({ message: "No API Key" });
    });
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    expect(Pebble.sendAppMessage).toHaveBeenCalledTimes(1);
    const msg = (Pebble.sendAppMessage as any).mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe("No API Key");
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test("sends error status to watch when weather fetch fails with Invalid API Key", () => {
    weather.getWeather.mockImplementation((opts: any, cb: any) => {
      cb({ message: "Invalid API Key" });
    });
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    const msg = (Pebble.sendAppMessage as any).mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe("Invalid API Key");
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test("sends error status to watch when weather fetch fails with Network Error", () => {
    weather.getWeather.mockImplementation((opts: any, cb: any) => {
      cb({ message: "Network Error" });
    });
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    const msg = (Pebble.sendAppMessage as any).mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe("Network Error");
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test("sends error status to watch when weather fetch fails with No Location", () => {
    weather.getWeather.mockImplementation((opts: any, cb: any) => {
      cb({ message: "No Location" });
    });
    const payload: Record<string | number, unknown> = {};
    payload[mk.GET_WEATHER] = 1;
    _handlers.appmessage({ payload: payload });
    const msg = (Pebble.sendAppMessage as any).mock.calls[0][0];
    expect(msg[mk.CONDITIONS]).toBe("No Location");
    expect(msg).not.toHaveProperty(String(mk.TEMPERATURE));
  });

  test("handles string-keyed payload from real hardware", () => {
    weather.getWeather.mockImplementation((opts: any, cb: any) => {
      cb(
        null,
        { tempF: 72, tempC: 22, conditions: "Clear", conditionCode: 800 },
        null,
      );
    });
    _handlers.appmessage({
      payload: {
        GET_WEATHER: 1,
        WEATHER_USE_GPS: 0,
        WEATHER_LOCATION: "London",
      },
    });
    expect(weather.getWeather).toHaveBeenCalledTimes(1);
    const args = weather.getWeather.mock.calls[0][0];
    expect(args.useGPS).toBe(0);
    expect(args.location).toBe("London");
  });

  test("ignores string-keyed payload without GET_WEATHER", () => {
    _handlers.appmessage({ payload: { SOME_OTHER_KEY: 1 } });
    expect(weather.getWeather).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  (weather.getWeather as any).mockRestore?.();
});
