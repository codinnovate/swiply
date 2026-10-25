// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

// The brand moved from orange to the logo's blue (#075AF2) and teal
// (#11CFC3); these are the old orange values that kept leaking back in.
const OLD_ORANGE = /#(FF5A1F|FF6F3C|FFF0E9|ef6848)\b|rgba\(255,\s*90,\s*31/i;

describe("brand theme", () => {
  it("uses the logo blue as the primary color in both themes", () => {
    const css = read("src/app/globals.css");
    const primaries = [...css.matchAll(/--primary:\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)];

    expect(primaries).toHaveLength(2);
    for (const [, , , hue] of primaries) {
      expect(Number(hue)).toBeGreaterThanOrEqual(255);
      expect(Number(hue)).toBeLessThanOrEqual(265);
    }
  });

  it("leaves no orange in the landing page, app icon or manifest", () => {
    const landing = readdirSync(path.join(root, "src/components/marketing/landing")).map(
      (file) => `src/components/marketing/landing/${file}`,
    );

    for (const file of [...landing, "public/icon.svg", "src/app/manifest.ts"]) {
      expect(read(file), file).not.toMatch(OLD_ORANGE);
    }
    expect(read("src/app/manifest.ts")).toContain('theme_color: "#075AF2"');
  });
});
