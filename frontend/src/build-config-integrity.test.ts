// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Build configs run as Node code on every dev server start and deploy, which
// makes them a target for injected loaders: a normal-looking first line, then
// a very long line of whitespace hiding obfuscated code that spawns a process.
const MAX_LINE_LENGTH = 300;
const FORBIDDEN = [
  /child_process/,
  /createRequire/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /_0x[0-9a-f]{4,}/i,
];

function configProblems(source: string): string[] {
  const problems: string[] = [];
  source.split("\n").forEach((line, index) => {
    if (line.length > MAX_LINE_LENGTH) {
      problems.push(`line ${index + 1} is ${line.length} characters long`);
    }
  });
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source)) problems.push(`matches ${pattern}`);
  }
  return problems;
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const configFiles = ["frontend", "postlock-web"].flatMap((app) =>
  readdirSync(path.join(repoRoot, app))
    .filter((name) => /\.config\.[cm]?[jt]s$/.test(name))
    .map((name) => path.join(app, name)),
);

describe("build config integrity", () => {
  it("finds the configs of both web apps", () => {
    expect(configFiles).toEqual(
      expect.arrayContaining([
        path.join("frontend", "postcss.config.mjs"),
        path.join("frontend", "next.config.ts"),
        path.join("postlock-web", "postcss.config.mjs"),
        path.join("postlock-web", "next.config.ts"),
      ]),
    );
  });

  it.each(configFiles)("%s contains no hidden or obfuscated code", (file) => {
    const source = readFileSync(path.join(repoRoot, file), "utf8");
    expect(configProblems(source)).toEqual([]);
  });

  it("flags a whitespace-hidden obfuscated payload", () => {
    const injected = [
      "import { createRequire } from 'module';",
      "const require = createRequire(import.meta.url);",
      "export default { plugins: {} };" +
        "\t".repeat(400) +
        "const _0x54d6a0=_0x1f2e;const {spawn}=require('child_' + 'process');",
    ].join("\n");

    expect(configProblems(injected)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^line 3 is \d+ characters long$/),
        `matches ${/createRequire/}`,
        `matches ${/_0x[0-9a-f]{4,}/i}`,
      ]),
    );
  });

  it("accepts a plain postcss config", () => {
    expect(
      configProblems(
        'export default { plugins: { "@tailwindcss/postcss": {} } };\n',
      ),
    ).toEqual([]);
  });
});
