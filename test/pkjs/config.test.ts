import { beforeEach, describe, expect, mock, test } from "bun:test";
import "../mocks/pebble";
import * as cfg from "../../src/pkjs/config";

beforeEach(() => {
  (globalThis as any).localStorage._reset();
  mock.clearAllMocks();
});

describe("storeApiKey / getApiKey", () => {
  test("stores and retrieves API key", () => {
    cfg.storeApiKey("MY_SECRET_KEY_123");
    expect(cfg.getApiKey()).toBe("MY_SECRET_KEY_123");
  });

  test("returns empty string when no key stored", () => {
    expect(cfg.getApiKey()).toBe("");
  });

  test("stores empty string when called with falsy", () => {
    cfg.storeApiKey("");
    expect(cfg.getApiKey()).toBe("");
  });

  test("stores empty string when called with null", () => {
    cfg.storeApiKey(null);
    expect(cfg.getApiKey()).toBe("");
  });

  test("overwrites previous key", () => {
    cfg.storeApiKey("first-key");
    cfg.storeApiKey("second-key");
    expect(cfg.getApiKey()).toBe("second-key");
  });
});
