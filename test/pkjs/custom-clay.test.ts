import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import "../mocks/pebble";

import customClay from "../../src/pkjs/custom-clay";

function createMockClayConfig() {
  const handlers: Record<string, Array<() => void>> = {};
  const items: Record<string, any> = {};

  const clayConfig = {
    meta: {
      userData: {},
    },
    EVENTS: {
      AFTER_BUILD: "AFTER_BUILD",
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
  test("loads API key from Clay userData into input on AFTER_BUILD", () => {
    const clay = createMockClayConfig();
    clay.meta.userData = { apiKey: "my-stored-key" };
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");

    expect(apiKeyItem.set).toHaveBeenCalledWith("my-stored-key");
  });

  test("does not set value when no API key is provided", () => {
    const clay = createMockClayConfig();
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");

    expect(apiKeyItem.set).not.toHaveBeenCalled();
  });

  test("does not set value when API key is an empty string", () => {
    const clay = createMockClayConfig();
    clay.meta.userData = { apiKey: "" };
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");

    expect(apiKeyItem.set).not.toHaveBeenCalled();
  });

  test("does nothing when owmApiKey item is not found", () => {
    const clay = createMockClayConfig();

    customClay.call(clay as any, {});
    expect(() => {
      clay._trigger("AFTER_BUILD");
    }).not.toThrow();
  });

  test("ignores non-string API key userData", () => {
    const clay = createMockClayConfig();
    clay.meta.userData = { apiKey: 12345 };
    const apiKeyItem = createMockItem("");
    clay._addItem("owmApiKey", apiKeyItem);

    customClay.call(clay as any, {});
    clay._trigger("AFTER_BUILD");

    expect(apiKeyItem.set).not.toHaveBeenCalled();
  });
});
