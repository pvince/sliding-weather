import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import "../mocks/pebble";

const STORAGE_KEY = "sliding_weather_owm_api_key";
import customClay from "../../src/pkjs/custom-clay";

function createMockClayConfig() {
  const handlers: Record<string, Array<() => void>> = {};
  const items: Record<string, any> = {};

  const clayConfig = {
    EVENTS: {
      AFTER_BUILD: "AFTER_BUILD",
      BEFORE_DESTROY: "BEFORE_DESTROY",
    },
    on: jest.fn((event: string, handler: () => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    getItemById: jest.fn((id: string) => items[id] || null),
    _trigger: (event: string) => {
      (handlers[event] || []).forEach((fn) => {
        fn();
      });
    },
    _addItem: (id: string, item: any) => {
      items[id] = item;
    },
  };

  return clayConfig;
}

function createMockItem(initialValue = "") {
  let value = initialValue;
  return {
    get: jest.fn(() => value),
    set: jest.fn((v: string) => {
      value = v;
    }),
  };
}

beforeEach(() => {
  (globalThis as any).localStorage._reset();
  mock.clearAllMocks();
});

describe("custom-clay", () => {
  test("loads stored API key into input on AFTER_BUILD", () => {
    (globalThis as any).localStorage.setItem(STORAGE_KEY, "my-stored-key");

    const clay = createMockClayConfig();
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");

    expect(apiKeyItem.set).toHaveBeenCalledWith("my-stored-key");
  });

  test("does not set value when no stored key exists", () => {
    const clay = createMockClayConfig();
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");

    expect(apiKeyItem.set).not.toHaveBeenCalled();
  });

  test("saves API key to localStorage on BEFORE_DESTROY", () => {
    const clay = createMockClayConfig();
    const apiKeyItem = createMockItem("new-api-key");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");
    clay._trigger("BEFORE_DESTROY");

    expect((globalThis as any).localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      "new-api-key",
    );
  });

  test("saves empty string when API key input is cleared", () => {
    const clay = createMockClayConfig();
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");
    clay._trigger("BEFORE_DESTROY");

    expect((globalThis as any).localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      "",
    );
  });

  test("does nothing when owmApiKey item is not found", () => {
    const clay = createMockClayConfig();

    customClay.call(clay as any, {});
    expect(() => {
      clay._trigger("AFTER_BUILD");
    }).not.toThrow();
  });

  test("round-trips API key through store and load", () => {
    const clay1 = createMockClayConfig();
    const apiKeyItem1 = createMockItem("round-trip-key");
    clay1._addItem("owmApiKey", apiKeyItem1);

    customClay.call(clay1 as any, {});
    clay1._trigger("AFTER_BUILD");
    clay1._trigger("BEFORE_DESTROY");

    const clay2 = createMockClayConfig();
    const apiKeyItem2 = createMockItem("");
    clay2._addItem("owmApiKey", apiKeyItem2);

    customClay.call(clay2 as any, {});
    clay2._trigger("AFTER_BUILD");

    expect(apiKeyItem2.set).toHaveBeenCalledWith("round-trip-key");
  });
});
