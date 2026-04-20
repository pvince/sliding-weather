import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PebbleMediaResource = {
  name: string;
  file: string;
  menuIcon?: boolean;
  targetPlatforms?: string[];
};

type PebbleConfig = {
  pebble?: {
    targetPlatforms?: string[];
    resources?: {
      media?: PebbleMediaResource[];
    };
  };
};

const projectRoot = join(import.meta.dir, "../..");
const packageJsonPath = join(projectRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PebbleConfig;
const mediaResources = packageJson.pebble?.resources?.media ?? [];

const expectedPreviewPlatforms = [
  "aplite",
  "basalt",
  "chalk",
  "diorite",
  "emery",
  "flint",
  "gabbro",
];

describe("pebble resource previews", () => {
  test("defines at least one media resource", () => {
    expect(mediaResources.length).toBeGreaterThan(0);
  });

  test("defines a menu icon resource", () => {
    const menuIcon = mediaResources.find((resource) => resource.menuIcon === true);

    expect(menuIcon).toBeDefined();
    expect(menuIcon?.name).toBe("IMAGE_MENU_ICON");
    expect(menuIcon?.file).toBe("images/menu-icon.png");
  });

  test("defines one preview resource for each target platform", () => {
    const previews = mediaResources.filter((resource) =>
      resource.name.startsWith("IMAGE_PREVIEW_"),
    );

    expect(previews.length).toBe(expectedPreviewPlatforms.length);

    for (const platform of expectedPreviewPlatforms) {
      const match = previews.find((resource) =>
        resource.targetPlatforms?.length === 1 &&
        resource.targetPlatforms[0] === platform,
      );

      expect(match).toBeDefined();
    }
  });

  test("does not include preview resources for unsupported platforms", () => {
    const configuredPlatforms = new Set(packageJson.pebble?.targetPlatforms ?? []);
    const previews = mediaResources.filter((resource) =>
      resource.name.startsWith("IMAGE_PREVIEW_"),
    );

    for (const preview of previews) {
      const platform = preview.targetPlatforms?.[0];
      expect(platform).toBeDefined();
      expect(configuredPlatforms.has(platform as string)).toBe(true);
    }
  });

  test("references preview image files that exist in the repository", () => {
    for (const resource of mediaResources) {
      expect(resource.file).toBeDefined();
      const absolutePath = join(projectRoot, "resources", resource.file);
      expect(existsSync(absolutePath)).toBe(true);
    }
  });

  test("preview images match their native device dimensions", () => {
    // Read width/height from PNG IHDR header bytes (offset 16-23 in the file)
    function pngDimensions(filePath: string): [number, number] {
      const buf = readFileSync(filePath);
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      return [w, h];
    }

    const expected: Record<string, [number, number]> = {
      "images/menu-icon.png":        [25,  25],
      "images/preview-aplite.png":   [144, 168],
      "images/preview-basalt.png":   [144, 168],
      "images/preview-chalk.png":    [180, 180],
      "images/preview-diorite.png":  [144, 168],
      "images/preview-emery.png":    [200, 228],
      "images/preview-flint.png":    [144, 168],
      "images/preview-gabbro.png":   [260, 260],
    };

    for (const [file, [w, h]] of Object.entries(expected)) {
      const absolutePath = join(projectRoot, "resources", file);
      const [actualW, actualH] = pngDimensions(absolutePath);
      expect(actualW).toBe(w);
      expect(actualH).toBe(h);
    }
  });
});
