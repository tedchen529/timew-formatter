import { describe, it, expect, vi } from "vitest";

// CLI is a process, so we test usage and error handling via spawn
import { spawnSync } from "child_process";
import path from "path";

describe("cli.js", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.js");

  it("shows usage for no args", () => {
    const result = spawnSync("node", [cliPath], { encoding: "utf-8" });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Usage:/);
  });

  it("shows usage for invalid command", () => {
    const result = spawnSync("node", [cliPath, "foo"], { encoding: "utf-8" });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Usage:/);
  });

  it("shows usage for invalid date", () => {
    const result = spawnSync("node", [cliPath, "fetch", "notadate"], {
      encoding: "utf-8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Invalid date format/);
  });
});
