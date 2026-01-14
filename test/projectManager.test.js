import { describe, it, expect, vi } from "vitest";
import * as projectManager from "../src/utils/projectManager";

// parseAnnotation

describe("parseAnnotation", () => {
  it("parses annotation with dash", () => {
    const result = projectManager.parseAnnotation("proj1 - some note");
    expect(result).toEqual({ projectName: "proj1", annotation: "some note" });
  });

  it("parses annotation without dash", () => {
    const result = projectManager.parseAnnotation("proj2");
    expect(result).toEqual({ projectName: "proj2", annotation: "" });
  });

  it("handles empty string", () => {
    const result = projectManager.parseAnnotation("");
    expect(result).toEqual({ projectName: "default", annotation: "" });
  });

  it("handles null", () => {
    const result = projectManager.parseAnnotation(null);
    expect(result).toEqual({ projectName: "default", annotation: "" });
  });
});

// getOrCreateProject

describe("getOrCreateProject", () => {
  it("returns existing project id", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 42 }] }),
    };
    const id = await projectManager.getOrCreateProject(client, "proj1");
    expect(id).toBe(42);
  });

  it("creates new project if not found", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 99 }] }),
    };
    const id = await projectManager.getOrCreateProject(client, "proj2");
    expect(id).toBe(99);
  });
});

// processEntryAnnotation

describe("processEntryAnnotation", () => {
  it("returns projectId and annotation", async () => {
    vi.spyOn(projectManager, "parseAnnotation").mockReturnValue({
      projectName: "proj3",
      annotation: "foo",
    });
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 123 }] }),
    };
    const result = await projectManager.processEntryAnnotation(
      client,
      "proj3 - foo"
    );
    expect(result).toEqual({ projectId: 123, annotation: "foo" });
  });
});
