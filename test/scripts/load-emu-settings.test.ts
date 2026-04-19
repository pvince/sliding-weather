import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  getAppUuid,
  getPebbleSdkVersion,
  getTargetPlatforms,
  loadSettings,
  writeToPebbleLocalStorage,
} from "../../scripts/load-emu-settings";

// ---------------------------------------------------------------------------
// settings.local.json.template — committed file must be valid
// ---------------------------------------------------------------------------
describe("settings.local.json.template", () => {
  const templatePath = join(
    import.meta.dir,
    "../../settings.local.json.template",
  );

  test("exists in the repository", () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  test("is valid JSON", () => {
    const file = Bun.file(templatePath);
    expect(() => file.json()).not.toThrow();
  });

  test("contains owmApiKey field as a string", async () => {
    const parsed = await Bun.file(templatePath).json();
    expect(typeof parsed.owmApiKey).toBe("string");
  });

  test("owmApiKey is empty string in template", async () => {
    const parsed = await Bun.file(templatePath).json();
    expect(parsed.owmApiKey).toBe("");
  });
});

// ---------------------------------------------------------------------------
// loadSettings()
// ---------------------------------------------------------------------------
describe("loadSettings", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `emu-settings-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns settings when file exists and is valid", () => {
    const path = join(tmpDir, "settings.local.json");
    writeFileSync(path, JSON.stringify({ owmApiKey: "abc123" }));
    expect(loadSettings(path)).toEqual({ owmApiKey: "abc123" });
  });

  test("returns empty string owmApiKey when key is blank", () => {
    const path = join(tmpDir, "settings.local.json");
    writeFileSync(path, JSON.stringify({ owmApiKey: "" }));
    expect(loadSettings(path)).toEqual({ owmApiKey: "" });
  });

  test("throws a helpful error when file does not exist", () => {
    const path = join(tmpDir, "missing.json");
    expect(() => loadSettings(path)).toThrow(/not found/);
    expect(() => loadSettings(path)).toThrow(/settings.local.json.template/);
  });

  test("throws when file contains invalid JSON", () => {
    const path = join(tmpDir, "settings.local.json");
    writeFileSync(path, "not json");
    expect(() => loadSettings(path)).toThrow(/parse/i);
  });

  test("throws when owmApiKey field is missing", () => {
    const path = join(tmpDir, "settings.local.json");
    writeFileSync(path, JSON.stringify({ other: "field" }));
    expect(() => loadSettings(path)).toThrow(/owmApiKey/);
  });

  test("throws when file contains a non-object JSON value", () => {
    const path = join(tmpDir, "settings.local.json");
    writeFileSync(path, JSON.stringify(["array"]));
    expect(() => loadSettings(path)).toThrow(/owmApiKey/);
  });
});

// ---------------------------------------------------------------------------
// getPebbleSdkVersion()
// ---------------------------------------------------------------------------
describe("getPebbleSdkVersion", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pebble-sdk-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns the version from the current symlink target", () => {
    const sdkVersionDir = join(tmpDir, "SDKs", "4.9.148");
    mkdirSync(sdkVersionDir, { recursive: true });
    symlinkSync(sdkVersionDir, join(tmpDir, "SDKs", "current"));
    expect(getPebbleSdkVersion(tmpDir)).toBe("4.9.148");
  });

  test("throws a helpful error when the current symlink is missing", () => {
    mkdirSync(join(tmpDir, "SDKs"), { recursive: true });
    expect(() => getPebbleSdkVersion(tmpDir)).toThrow(/current/);
  });

  test("returns the version from the real pebble SDK installation", () => {
    const version = getPebbleSdkVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ---------------------------------------------------------------------------
// getAppUuid()
// ---------------------------------------------------------------------------
describe("getAppUuid", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pebble-uuid-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns the UUID from the project package.json", () => {
    const uuid = getAppUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("reads UUID from a custom package.json path", () => {
    const pkgPath = join(tmpDir, "package.json");
    writeFileSync(
      pkgPath,
      JSON.stringify({ pebble: { uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" } }),
    );
    expect(getAppUuid(pkgPath)).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  test("throws when uuid is missing from package.json", () => {
    const pkgPath = join(tmpDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ pebble: {} }));
    expect(() => getAppUuid(pkgPath)).toThrow(/uuid/i);
  });
});

// ---------------------------------------------------------------------------
// getTargetPlatforms()
// ---------------------------------------------------------------------------
describe("getTargetPlatforms", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pebble-platforms-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns target platforms from the project package.json", () => {
    const platforms = getTargetPlatforms();
    expect(platforms).toContain("basalt");
    expect(platforms.length).toBeGreaterThan(0);
  });

  test("returns platforms from a custom package.json path", () => {
    const pkgPath = join(tmpDir, "package.json");
    writeFileSync(
      pkgPath,
      JSON.stringify({ pebble: { targetPlatforms: ["basalt", "chalk"] } }),
    );
    expect(getTargetPlatforms(pkgPath)).toEqual(["basalt", "chalk"]);
  });

  test("returns ['basalt'] as default when targetPlatforms is absent", () => {
    const pkgPath = join(tmpDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ pebble: {} }));
    expect(getTargetPlatforms(pkgPath)).toEqual(["basalt"]);
  });
});

// ---------------------------------------------------------------------------
// writeToPebbleLocalStorage()
// ---------------------------------------------------------------------------
describe("writeToPebbleLocalStorage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pebble-ls-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Read a value from a dbm.dumb file using Python 3. */
  function readDbmValue(dbPath: string, key: string): string {
    const result = spawnSync("python3", [
      "-c",
      [
        "import sys, dbm.dumb",
        "db = dbm.dumb.open(sys.argv[1], 'r')",
        "print(db.get(sys.argv[2], b'').decode())",
        "db.close()",
      ].join("; "),
      dbPath,
      key,
    ]);
    if (result.error) throw result.error;
    return result.stdout.toString().trim();
  }

  test("writes the API key to the DBM file", () => {
    writeToPebbleLocalStorage(
      tmpDir,
      "4.9.148",
      "basalt",
      "test-uuid",
      "sliding_weather_owm_api_key",
      "my-api-key-value",
    );

    const dbPath = join(
      tmpDir,
      "4.9.148",
      "basalt",
      "localstorage",
      "test-uuid",
    );
    expect(readDbmValue(dbPath, "sliding_weather_owm_api_key")).toBe(
      "my-api-key-value",
    );
  });

  test("creates parent directories when they do not exist", () => {
    writeToPebbleLocalStorage(
      tmpDir,
      "sdk",
      "chalk",
      "some-uuid",
      "key",
      "val",
    );
    expect(existsSync(join(tmpDir, "sdk", "chalk", "localstorage"))).toBe(true);
  });

  test("overwrites an existing key", () => {
    writeToPebbleLocalStorage(tmpDir, "sdk", "basalt", "uuid", "key", "first");
    writeToPebbleLocalStorage(tmpDir, "sdk", "basalt", "uuid", "key", "second");

    const dbPath = join(tmpDir, "sdk", "basalt", "localstorage", "uuid");
    expect(readDbmValue(dbPath, "key")).toBe("second");
  });

  test("stores an empty string without error", () => {
    writeToPebbleLocalStorage(tmpDir, "sdk", "basalt", "uuid", "key", "");
    const dbPath = join(tmpDir, "sdk", "basalt", "localstorage", "uuid");
    expect(readDbmValue(dbPath, "key")).toBe("");
  });
});
