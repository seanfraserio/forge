import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { cliVersion, createProgram } from "../program.js";

const require = createRequire(import.meta.url);
const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "../../package.json");
const packageVersion = require(packageJsonPath).version as string;

function capture(argv: string[]): string {
  const program = createProgram();
  const chunks: string[] = [];
  program.exitOverride();
  program.configureOutput({
    writeOut: (text) => chunks.push(text),
    writeErr: (text) => chunks.push(text),
  });
  try {
    program.parse(argv, { from: "user" });
  } catch (err) {
    const code = (err as { exitCode?: number; code?: string }).exitCode ?? (err as { code?: string }).code;
    if (code !== 0 && code !== "commander.helpDisplayed" && code !== "commander.version") {
      throw err;
    }
  }
  return chunks.join("");
}

describe("CLI version source", () => {
  it("prints the package.json version from one source, not a second hardcoded number", () => {
    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageVersion).not.toBe("0.2.5");
    expect(cliVersion).toBe(packageVersion);

    const programSource = readFileSync(new URL("../program.ts", import.meta.url), "utf8");
    expect(programSource).not.toMatch(/\.version\(\s*["']\d+\.\d+\.\d+["']\s*\)/);
    expect(programSource).toContain('from "./version.js"');
    const versionSource = readFileSync(new URL("../version.ts", import.meta.url), "utf8");
    expect(versionSource).toContain('require("../package.json")');
    expect(versionSource).toContain("import.meta.url");
    expect(versionSource).not.toMatch(/["']0\.2\.5["']/);

    const program = createProgram();
    expect(program).toBeInstanceOf(Command);
    expect(program.version()).toBe(packageVersion);

    const versionOut = capture(["--version"]);
    expect(versionOut.trim()).toBe(packageVersion);
    expect(versionOut).not.toContain("0.2.5");

    const help = capture(["--help"]);
    expect(help).toContain("forgeai");
    expect(help).toContain("--version");
    expect(help).not.toContain("0.2.5");
  });
});
