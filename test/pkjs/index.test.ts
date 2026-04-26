import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from "bun:test";

const clayState = {
  instance: null as null | {
    generateUrl: ReturnType<typeof jest.fn>;
    getSettings: ReturnType<typeof jest.fn>;
    meta: { userData: Record<string, unknown> };
  },
};

// Only mock third-party modules that can't be loaded in test env
mock.module("@rebble/clay", () => ({
  default: Object.assign(
    jest.fn(function MockClay() {
    const instance = {
      generateUrl: jest.fn(() => "https://example.com/config"),
      getSettings: jest.fn((response: string, convert = true) => {
        const settings = JSON.parse(response);
        if (convert === false) {
          return settings;
        }

        const converted: Record<string, string | number> = {
          USE_CELSIUS: Number(settings.USE_CELSIUS?.value ?? 0),
          WEATHER_FREQUENCY: Number(settings.WEATHER_FREQUENCY?.value ?? 30),
        };

        if (settings.OWM_API_KEY) {
          converted.OWM_API_KEY = settings.OWM_API_KEY.value ?? "";
        }

        return converted;
      }),
      meta: { userData: {} },
    };

    clayState.instance = instance;
    return instance;
    }),
    {
      prepareSettingsForAppMessage: jest.fn(
        (settings: Record<string, { value: string | number | boolean }>) => {
          // Mirrors real Clay behaviour for all field types:
          //   string .value  → returned as string (select, input items)
          //   number .value  → returned as number (color picker, etc.)
          //   boolean .value → converted to 1/0 (toggle items)
          // OWM_API_KEY is stripped from sanitizedSettings before this is
          // called, so it will never appear here in normal operation.
          const converted: Record<string, string | number> = {};
          for (const key in settings) {
            const item = settings[key];
            const v = (item as { value?: unknown })?.value ?? item;
            if (typeof v === "boolean") {
              converted[key] = v ? 1 : 0;
            } else if (typeof v === "number") {
              converted[key] = v;
            } else {
              converted[key] = String(v);
            }
          }
          return converted;
        },
      ),
    },
  ),
}));

// Set up global mocks (Pebble, localStorage, etc.)
require("../mocks/pebble");

// Get the real weather module and spy on getWeather (avoids mock.module leaking to other test files)
const weather = require("../../src/pkjs/weather") as {
  getWeather: ReturnType<typeof jest.fn>;
};
jest.spyOn(weather as any, "getWeather").mockImplementation(jest.fn());
const cfg = require("../../src/pkjs/config") as {
  getApiKey: () => string;
  storeApiKey: ReturnType<typeof jest.fn>;
};
jest.spyOn(cfg as any, "storeApiKey");
const ClayModule = require("@rebble/clay") as {
  default: {
    prepareSettingsForAppMessage: ReturnType<typeof jest.fn>;
  };
};
const mk = require("../../build/js/message_keys.json") as Record<
  string,
  number
>;

// Load index.ts — registers all Pebble event listeners synchronously
require("../../src/pkjs/index");

// Capture handlers immediately, before any mock.clearAllMocks() calls
const _handlers: Record<string, (...args: any[]) => any> = {};
["ready", "appmessage", "showConfiguration", "webviewclosed"].forEach(
  (name) => {
  const call = (Pebble as any).addEventListener.mock.calls.find(
    (c: any[]) => c[0] === name,
  );
  if (call) _handlers[name] = call[1];
  },
);

beforeEach(() => {
  (globalThis as any).localStorage._reset();
  mock.clearAllMocks();
  (Pebble as any).getActiveWatchInfo.mockReturnValue({ platform: "basalt" });
  if (clayState.instance) {
    clayState.instance.generateUrl.mockClear();
    clayState.instance.getSettings.mockClear();
    clayState.instance.meta.userData = {};
  }
  ClayModule.default.prepareSettingsForAppMessage.mockClear();
});

describe("event listener registration", () => {
  test("registers ready handler", () => {
    expect(_handlers.ready).toBeDefined();
  });

  test("registers appmessage handler", () => {
    expect(_handlers.appmessage).toBeDefined();
  });

  test("registers showConfiguration handler", () => {
    expect(_handlers.showConfiguration).toBeDefined();
  });

  test("registers webviewclosed handler", () => {
    expect(_handlers.webviewclosed).toBeDefined();
  });
});

describe("configuration lifecycle", () => {
  test("opens Clay config with the stored API key in userData", () => {
    (globalThis as any).localStorage.setItem(
      "sliding_weather_owm_api_key",
      "stored-key",
    );

    _handlers.showConfiguration();

    expect(clayState.instance?.meta.userData.apiKey).toBe("stored-key");
    expect(clayState.instance?.generateUrl).toHaveBeenCalledTimes(1);
    expect(Pebble.openURL).toHaveBeenCalledWith("https://example.com/config");
  });

  test("opens Clay config when no API key is stored", () => {
    _handlers.showConfiguration();

    expect(clayState.instance?.meta.userData.apiKey).toBe("");
    expect(clayState.instance?.generateUrl).toHaveBeenCalledTimes(1);
    expect(Pebble.openURL).toHaveBeenCalledWith("https://example.com/config");
  });

  test("stores API key and forwards config settings on webviewclosed", () => {
    const response = JSON.stringify({
      OWM_API_KEY: { value: "new-key" },
      USE_CELSIUS: { value: "1" },
      WEATHER_FREQUENCY: { value: "60" },
    });
    const sanitizedResponse = JSON.stringify({
      USE_CELSIUS: { value: "1" },
      WEATHER_FREQUENCY: { value: "60" },
    });

    _handlers.webviewclosed({ response: response });

    expect(clayState.instance?.getSettings).toHaveBeenCalledWith(response, false);
    expect(ClayModule.default.prepareSettingsForAppMessage).toHaveBeenCalledWith(
      JSON.parse(sanitizedResponse),
    );
    expect(cfg.storeApiKey).toHaveBeenCalledWith("new-key");
    expect(Pebble.sendAppMessage).toHaveBeenCalledWith(
      {
        USE_CELSIUS: 1,
        WEATHER_FREQUENCY: 60,
      },
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("clears the stored API key when the config submits an empty value", () => {
    const response = JSON.stringify({
      OWM_API_KEY: { value: "" },
      USE_CELSIUS: { value: "0" },
    });
    const sanitizedResponse = JSON.stringify({
      USE_CELSIUS: { value: "0" },
    });

    _handlers.webviewclosed({ response: response });

    expect(clayState.instance?.getSettings).toHaveBeenCalledWith(response, false);
    expect(ClayModule.default.prepareSettingsForAppMessage).toHaveBeenCalledWith(
      JSON.parse(sanitizedResponse),
    );
    expect(cfg.storeApiKey).toHaveBeenCalledWith("");
    expect(Pebble.sendAppMessage).toHaveBeenCalledWith(
      {
        USE_CELSIUS: 0,
      },
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("filters the API key when Clay returns numeric message-key ids", () => {
    const response = JSON.stringify({
      OWM_API_KEY: { value: "hardware-key" },
      USE_CELSIUS: { value: "1" },
    });
    const sanitizedResponse = JSON.stringify({
      USE_CELSIUS: { value: "1" },
    });

    clayState.instance?.getSettings.mockImplementationOnce(
      (_response: string, convert = true) => {
        if (convert === false) {
          return {
            OWM_API_KEY: { value: "hardware-key" },
            USE_CELSIUS: { value: "1" },
          };
        }

        return {
          [mk.USE_CELSIUS]: 1,
        };
      },
    );
    ClayModule.default.prepareSettingsForAppMessage.mockImplementationOnce(() => ({
      [mk.USE_CELSIUS]: 1,
    }));

    _handlers.webviewclosed({ response: response });

    expect(clayState.instance?.getSettings).toHaveBeenCalledWith(response, false);
    expect(ClayModule.default.prepareSettingsForAppMessage).toHaveBeenCalledWith(
      JSON.parse(sanitizedResponse),
    );
    expect(cfg.storeApiKey).toHaveBeenCalledWith("hardware-key");
    expect(Pebble.sendAppMessage).toHaveBeenCalledWith(
      {
        [mk.USE_CELSIUS]: 1,
      },
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("coerces Fahrenheit (USE_CELSIUS='0') string to number 0 before sending", () => {
    const response = JSON.stringify({
      USE_CELSIUS: { value: "0" },
    });

    _handlers.webviewclosed({ response: response });

    expect(Pebble.sendAppMessage).toHaveBeenCalledWith(
      { USE_CELSIUS: 0 },
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("does not coerce non-numeric string setting values (e.g., location)", () => {
    const response = JSON.stringify({
      WEATHER_LOCATION: { value: "London, UK" },
    });

    _handlers.webviewclosed({ response: response });

    expect(Pebble.sendAppMessage).toHaveBeenCalledWith(
      { WEATHER_LOCATION: "London, UK" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("ignores webviewclosed events without a response", () => {
    _handlers.webviewclosed(null);
    _handlers.webviewclosed({ response: null });

    expect(cfg.storeApiKey).not.toHaveBeenCalled();
    expect(Pebble.sendAppMessage).not.toHaveBeenCalled();
  });

  test("forwards config when raw settings omit OWM_API_KEY entirely", () => {
    const response = JSON.stringify({
      USE_CELSIUS: { value: "1" },
      WEATHER_FREQUENCY: { value: "15" },
    });

    _handlers.webviewclosed({ response: response });

    expect(clayState.instance?.getSettings).toHaveBeenCalledWith(response, false);
    expect(ClayModule.default.prepareSettingsForAppMessage).toHaveBeenCalledWith(
      JSON.parse(response),
    );
    expect(cfg.storeApiKey).not.toHaveBeenCalled();
    expect(Pebble.sendAppMessage).toHaveBeenCalledWith(
      {
        USE_CELSIUS: 1,
        WEATHER_FREQUENCY: 15,
      },
      expect.any(Function),
      expect.any(Function),
    );
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
