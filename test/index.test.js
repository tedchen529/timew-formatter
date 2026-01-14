import { describe, it, expect } from "vitest";
import "../src/index.js";

describe("index.js", () => {
  it("should not throw on import", () => {
    expect(() => require("../src/index.js")).not.toThrow();
  });
});
