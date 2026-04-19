import {
  existsSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const SETTINGS_FILE = resolve(import.meta.dir, "../settings.local.json");

/** The localStorage key used by the watchface's PebbleKit JS. */
const API_KEY_STORAGE_KEY = "sliding_weather_owm_api_key";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalSettings {
  owmApiKey: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read and validate settings.local.json. Throws with a helpful message if missing or malformed. */
export function loadSettings(settingsPath: string): LocalSettings {
  if (!existsSync(settingsPath)) {
    throw new Error(
      `settings.local.json not found at: ${settingsPath}\n` +
        `Copy the template to get started:\n` +
        `  cp settings.local.json.template settings.local.json\n` +
        `Then fill in your OpenWeatherMap API key.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch (e) {
    throw new Error(`Failed to parse ${settingsPath}: ${(e as Error).message}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).owmApiKey !== "string"
  ) {
    throw new Error(
      `${settingsPath} must be a JSON object with an "owmApiKey" string field.`,
    );
  }

  return parsed as LocalSettings;
}

/**
 * Determine the active Pebble SDK version by reading the `current` symlink in
 * the pebble SDK directory (e.g. ~/.pebble-sdk/SDKs/current -> 4.9.148).
 */
export function getPebbleSdkVersion(pebbleSdkDir?: string): string {
  const sdkDir = pebbleSdkDir ?? join(homedir(), ".pebble-sdk");
  const currentLink = join(sdkDir, "SDKs", "current");
  try {
    return basename(realpathSync(currentLink));
  } catch {
    throw new Error(
      `Could not determine active Pebble SDK version.\n` +
        `Expected a 'current' symlink at: ${currentLink}`,
    );
  }
}

/** Read the app UUID from package.json. */
export function getAppUuid(packageJsonPath?: string): string {
  const pkgPath =
    packageJsonPath ?? resolve(import.meta.dir, "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    pebble?: { uuid?: string };
  };
  const uuid = pkg.pebble?.uuid;
  if (!uuid) throw new Error("Could not find pebble.uuid in package.json");
  return uuid;
}

/** Read the list of target platforms from package.json. */
export function getTargetPlatforms(packageJsonPath?: string): string[] {
  const pkgPath =
    packageJsonPath ?? resolve(import.meta.dir, "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    pebble?: { targetPlatforms?: string[] };
  };
  return pkg.pebble?.targetPlatforms ?? ["basalt"];
}

/**
 * Write a key/value pair directly to the Pebble emulator's persistent
 * localStorage (stored as a dbm.dumb file).
 *
 * Storage path: <pebbleSdkDir>/<sdkVersion>/<platform>/localstorage/<appUuid>
 *
 * Uses Python 3's dbm.dumb module (same format as the pebble phone simulator)
 * so the emulator reads the value on the next localStorage.getItem() call.
 *
 * @param pebbleSdkDir  Base directory (defaults to ~/.pebble-sdk)
 */
export function writeToPebbleLocalStorage(
  pebbleSdkDir: string,
  sdkVersion: string,
  platform: string,
  appUuid: string,
  storageKey: string,
  value: string,
): void {
  const dbPath = join(
    pebbleSdkDir,
    sdkVersion,
    platform,
    "localstorage",
    appUuid,
  );

  // Python script: create directories, open/create the dbm.dumb db, write key
  const pyScript = [
    "import sys, dbm.dumb, os",
    "db_path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]",
    "os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)",
    "db = dbm.dumb.open(db_path, 'c')",
    "db[key] = val",
    "db.close()",
  ].join("; ");

  execFileSync("python3", ["-c", pyScript, dbPath, storageKey, value], {
    stdio: "inherit",
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const platformArg = process.argv[2];

  const settings = loadSettings(SETTINGS_FILE);

  if (!settings.owmApiKey) {
    console.warn(
      "Warning: owmApiKey is empty in settings.local.json -- no key will be written.",
    );
  }

  const pebbleSdkDir = join(homedir(), ".pebble-sdk");
  const sdkVersion = getPebbleSdkVersion(pebbleSdkDir);
  const appUuid = getAppUuid();
  const platforms = platformArg ? [platformArg] : getTargetPlatforms();

  console.log(`SDK:      ${sdkVersion}`);
  console.log(`App UUID: ${appUuid}`);
  console.log(`Platform: ${platforms.join(", ")}`);
  console.log();

  for (const platform of platforms) {
    writeToPebbleLocalStorage(
      pebbleSdkDir,
      sdkVersion,
      platform,
      appUuid,
      API_KEY_STORAGE_KEY,
      settings.owmApiKey,
    );
    console.log(`OK  ${platform}`);
  }

  console.log("\nAPI key written. Start (or restart) the emulator:");
  console.log("  pebble install --emulator basalt");
}
