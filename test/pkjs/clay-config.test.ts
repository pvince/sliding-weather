import { describe, expect, test } from "bun:test";
import clayConfig from "../../src/pkjs/clay-config";

describe("clay-config structure", () => {
  test("exports an array", () => {
    expect(Array.isArray(clayConfig)).toBe(true);
  });

  test("has a submit button", () => {
    const submit = clayConfig.find((item) => item.type === "submit");
    expect(submit).toBeDefined();
    expect(submit?.defaultValue).toBe("Save");
  });
});

describe("clay-config message keys", () => {
  function collectMessageKeys(config: typeof clayConfig): string[] {
    const keys: string[] = [];
    config.forEach((item) => {
      if ("messageKey" in item && (item as any).messageKey)
        keys.push((item as any).messageKey);
      if (item.items) {
        item.items.forEach((child) => {
          if (child.messageKey) keys.push(child.messageKey);
        });
      }
    });
    return keys;
  }

  const messageKeys = collectMessageKeys(clayConfig);

  test("includes all config-related message keys", () => {
    const expected = [
      "BACKGROUND_COLOR",
      "HR_COLOR",
      "MIN_COLOR",
      "WD_COLOR",
      "WEATHER_USE_GPS",
      "WEATHER_LOCATION",
      "USE_CELSIUS",
      "WEATHER_FREQUENCY",
      "VIBBRATE_BT_STATUS",
    ];
    expected.forEach((key) => {
      expect(messageKeys).toContain(key);
    });
  });

  test("does not include removed config keys", () => {
    const removed = [
      "SHAKE_FOR_LOHI",
      "DISPLAY_O_PREFIX",
      "DISPLAY_DATE",
      "HOURMINUTES_ALIGNMENT",
      "WEATHERDATE_READABILITY",
    ];
    removed.forEach((key) => {
      expect(messageKeys).not.toContain(key);
    });
  });

  test("does not include weather data or internal keys", () => {
    const excluded = [
      "TEMPERATURE",
      "TEMPERATURE_IN_C",
      "CONDITIONS",
      "CONDITION_CODE",
      "TEMPERATURE_LO",
      "TEMPERATURE_HI",
      "TEMPERATURE_IN_C_LO",
      "TEMPERATURE_IN_C_HI",
      "GET_WEATHER",
      "JS_READY",
      "DISPLAY_WEATHER",
    ];
    excluded.forEach((key) => {
      expect(messageKeys).not.toContain(key);
    });
  });

  test("has no duplicate message keys", () => {
    const unique = messageKeys.filter((v, i, a) => a.indexOf(v) === i);
    expect(unique.length).toBe(messageKeys.length);
  });

  test("keeps API key in the Clay form config", () => {
    expect(messageKeys).toContain("OWM_API_KEY");
  });
});

describe("messageKey inventory (package.json completeness)", () => {
  const pkg = require("../../package.json");
  const packageKeys = (pkg.pebble.messageKeys as string[]).slice().sort();

  const clayKeys = [
    "BACKGROUND_COLOR",
    "HR_COLOR",
    "MIN_COLOR",
    "WD_COLOR",
    "WEATHER_USE_GPS",
    "WEATHER_LOCATION",
    "USE_CELSIUS",
    "WEATHER_FREQUENCY",
    "VIBBRATE_BT_STATUS",
  ];

  const weatherDataKeys = [
    "TEMPERATURE",
    "TEMPERATURE_IN_C",
    "CONDITIONS",
    "CONDITION_CODE",
  ];

  const controlKeys = ["GET_WEATHER", "JS_READY"];

  const internalKeys = ["DISPLAY_WEATHER"];

  const allExpectedKeys = clayKeys
    .concat(weatherDataKeys, controlKeys, internalKeys)
    .sort();

  test("package.json messageKeys match the complete expected set", () => {
    expect(packageKeys).toEqual(allExpectedKeys);
  });

  test("no key exists in package.json without being categorized", () => {
    packageKeys.forEach((key: string) => {
      expect(allExpectedKeys).toContain(key);
    });
  });

  test("no expected key is missing from package.json", () => {
    allExpectedKeys.forEach((key) => {
      expect(packageKeys).toContain(key);
    });
  });

  test("package.json does not include OWM_API_KEY", () => {
    expect(packageKeys).not.toContain("OWM_API_KEY");
  });
});

describe("clay-config defaults", () => {
  function findItem(config: typeof clayConfig, messageKey: string): any {
    for (let i = 0; i < config.length; i++) {
      const item = config[i] as any;
      if (item.messageKey === messageKey) return item;
      if (item.items) {
        for (let j = 0; j < item.items.length; j++) {
          if (item.items[j].messageKey === messageKey) return item.items[j];
        }
      }
    }
    return null;
  }

  test("BACKGROUND_COLOR defaults to black", () => {
    const item = findItem(clayConfig, "BACKGROUND_COLOR");
    expect(item.defaultValue).toBe(0x000000);
  });

  test("HR_COLOR defaults to white", () => {
    const item = findItem(clayConfig, "HR_COLOR");
    expect(item.defaultValue).toBe(0xffffff);
  });

  test("WEATHER_FREQUENCY defaults to 30", () => {
    const item = findItem(clayConfig, "WEATHER_FREQUENCY");
    expect(item.defaultValue).toBe("30");
  });

  test("WEATHER_USE_GPS defaults to true", () => {
    const item = findItem(clayConfig, "WEATHER_USE_GPS");
    expect(item.defaultValue).toBe(true);
  });

  test("USE_CELSIUS defaults to Fahrenheit (0)", () => {
    const item = findItem(clayConfig, "USE_CELSIUS");
    expect(item.defaultValue).toBe("0");
  });

  test("VIBBRATE_BT_STATUS defaults to true", () => {
    const item = findItem(clayConfig, "VIBBRATE_BT_STATUS");
    expect(item.defaultValue).toBe(true);
  });
});

describe("clay-config capabilities", () => {
  test("colors section requires COLOR capability", () => {
    const colorSection = clayConfig.find(
      (item) =>
        item.type === "section" &&
        item.items &&
        item.items.some((child) => child.messageKey === "BACKGROUND_COLOR"),
    );
    expect(colorSection).toBeDefined();
    expect(colorSection?.capabilities).toEqual(["COLOR"]);
  });
});

describe("clay-config API key", () => {
  function findById(config: typeof clayConfig, id: string): any {
    for (let i = 0; i < config.length; i++) {
      const item = config[i] as any;
      if (item.id === id) return item;
      if (item.items) {
        for (let j = 0; j < item.items.length; j++) {
          if (item.items[j].id === id) return item.items[j];
        }
      }
    }
    return null;
  }

  test("has an API key input with id and messageKey", () => {
    const apiKey = findById(clayConfig, "owmApiKey");
    expect(apiKey).toBeDefined();
    expect(apiKey.type).toBe("input");
    expect(apiKey.messageKey).toBe("OWM_API_KEY");
  });

  test("API key input does not use password type", () => {
    const apiKey = findById(clayConfig, "owmApiKey");
    expect(apiKey.attributes.type).toBeUndefined();
  });
});
