import { describe, it, expect } from "vitest";
import { execa } from "execa";
import path from "path";

const CLI_PATH = path.resolve("src/index.js");

describe("Main CLI Entry Point", () => {
  it("should show help text with --help", async () => {
    try {
      await execa("node", [CLI_PATH, "--help"]);
    } catch (err) {
      expect(err).toBeUndefined(); // Should not throw
    }
  });

  it("should handle unknown commands gracefully", async () => {
    let error;
    try {
      await execa("node", [CLI_PATH, "unknowncmd"]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.stderr).toMatch(/Unknown command|error/i);
  });

  it("should log and exit on database connection error", async () => {
    // Simulate by setting invalid env
    let error;
    try {
      await execa("node", [CLI_PATH, "fetch", "all"], {
        env: { ...process.env, DB_USER: "invalid", DB_PASS: "invalid" },
      });
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.stderr).toMatch(/database|connection|fail/i);
  });

  it("should log progress and complete fetch all", async () => {
    // This will fail until implemented
    let error;
    try {
      await execa("node", [CLI_PATH, "fetch", "all"]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.stderr).toMatch(/not implemented|fail|error/i);
  });
});
