import { describe, it, expect, vi } from "vitest";
// Mock dependencies
vi.mock("pg", () => ({
  Client: vi.fn(() => ({
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));
vi.mock("child_process", () => ({ execSync: vi.fn() }));
vi.mock("fs", () => ({ readFileSync: vi.fn(), writeFileSync: vi.fn() }));
vi.mock("readline", () => ({
  createInterface: vi.fn(() => ({
    question: (q, cb) => cb("mock"),
    close: vi.fn(),
  })),
}));
vi.mock("../src/utils/projectManager", () => ({
  processEntryAnnotation: vi.fn(async () => ({
    projectId: 1,
    annotation: "foo",
  })),
}));

describe("fetchDateRange", () => {
  it("should run without throwing", async () => {
    const fetchDateRange = (await import("../src/actions/fetchDateRange"))
      .default;
    await expect(
      fetchDateRange("2025-01-01", "2025-01-02")
    ).resolves.not.toThrow();
  });
});
