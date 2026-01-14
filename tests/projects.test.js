import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  findProjectByName,
  createProject,
  ensureProjectExists,
  generateProjectDescription,
  getAllProjects,
} from "../src/database/projects.js";

// Mock the database connection
vi.mock("../src/database/connection.js", () => ({
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
}));

describe("Project Resolution Module", () => {
  let mockPool;
  let mockClient;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
      end: vi.fn(),
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("findProjectByName", () => {
    it("should find existing project by exact name match", async () => {
      const mockProject = {
        id: 1,
        projectName: "CODING",
        description: "Auto-generated project for timewarrior imports",
        created_at: "2026-01-14T10:00:00.000Z",
        updated_at: "2026-01-14T10:00:00.000Z",
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProject],
        rowCount: 1,
      });

      const result = await findProjectByName(mockPool, "CODING");

      expect(result).toEqual(mockProject);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM timewplus_projects WHERE "projectName" = $1',
        ["CODING"]
      );
    });

    it("should return null when project does not exist", async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await findProjectByName(mockPool, "NONEXISTENT");

      expect(result).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM timewplus_projects WHERE "projectName" = $1',
        ["NONEXISTENT"]
      );
    });

    it("should handle case-sensitive project name matching", async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await findProjectByName(mockPool, "coding"); // lowercase

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM timewplus_projects WHERE "projectName" = $1',
        ["coding"]
      );
    });

    it("should handle special characters in project names", async () => {
      const mockProject = {
        id: 2,
        projectName: "CLIENT_PROJECT",
        description: "Auto-generated project for timewarrior imports",
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProject],
        rowCount: 1,
      });

      const result = await findProjectByName(mockPool, "CLIENT_PROJECT");

      expect(result).toEqual(mockProject);
    });

    it("should handle empty and null project names", async () => {
      await expect(findProjectByName(mockPool, "")).rejects.toThrow(
        "Project name cannot be empty"
      );

      await expect(findProjectByName(mockPool, null)).rejects.toThrow(
        "Project name cannot be empty"
      );

      await expect(findProjectByName(mockPool, undefined)).rejects.toThrow(
        "Project name cannot be empty"
      );
    });

    it("should handle database query errors", async () => {
      const dbError = new Error("Database connection failed");
      mockPool.query.mockRejectedValue(dbError);

      await expect(findProjectByName(mockPool, "CODING")).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should trim whitespace from project names", async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await findProjectByName(mockPool, "  CODING  ");

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM timewplus_projects WHERE "projectName" = $1',
        ["CODING"]
      );
    });
  });

  describe("createProject", () => {
    it("should create new project with auto-generated description", async () => {
      const mockProject = {
        id: 3,
        projectName: "LEARNING",
        description: "Auto-generated project for timewarrior imports",
        created_at: "2026-01-14T10:30:00.000Z",
        updated_at: "2026-01-14T10:30:00.000Z",
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProject],
        rowCount: 1,
      });

      const result = await createProject(mockPool, "LEARNING");

      expect(result).toEqual(mockProject);
      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO timewplus_projects ("projectName", "description") VALUES ($1, $2) RETURNING *',
        ["LEARNING", "Auto-generated project for timewarrior imports"]
      );
    });

    it("should create project with custom description", async () => {
      const customDescription = "Custom project for specific tasks";
      const mockProject = {
        id: 4,
        projectName: "CUSTOM",
        description: customDescription,
        created_at: "2026-01-14T10:30:00.000Z",
        updated_at: "2026-01-14T10:30:00.000Z",
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProject],
        rowCount: 1,
      });

      const result = await createProject(mockPool, "CUSTOM", customDescription);

      expect(result).toEqual(mockProject);
      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO timewplus_projects ("projectName", "description") VALUES ($1, $2) RETURNING *',
        ["CUSTOM", customDescription]
      );
    });

    it("should handle duplicate project name errors", async () => {
      const duplicateError = new Error(
        'duplicate key value violates unique constraint "timewplus_projects_projectName_key"'
      );
      duplicateError.code = "23505";
      mockPool.query.mockRejectedValue(duplicateError);

      await expect(createProject(mockPool, "EXISTING")).rejects.toThrow(
        'Project "EXISTING" already exists'
      );
    });

    it("should handle invalid project names", async () => {
      await expect(createProject(mockPool, "")).rejects.toThrow(
        "Project name cannot be empty"
      );

      await expect(createProject(mockPool, null)).rejects.toThrow(
        "Project name cannot be empty"
      );

      await expect(createProject(mockPool, undefined)).rejects.toThrow(
        "Project name cannot be empty"
      );
    });

    it("should handle database insertion errors", async () => {
      const dbError = new Error("Database insertion failed");
      mockPool.query.mockRejectedValue(dbError);

      await expect(createProject(mockPool, "NEWPROJECT")).rejects.toThrow(
        "Database insertion failed"
      );
    });

    it("should trim whitespace from project names", async () => {
      const mockProject = {
        id: 5,
        projectName: "WHITESPACE",
        description: "Auto-generated project for timewarrior imports",
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProject],
        rowCount: 1,
      });

      await createProject(mockPool, "  WHITESPACE  ");

      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO timewplus_projects ("projectName", "description") VALUES ($1, $2) RETURNING *',
        ["WHITESPACE", "Auto-generated project for timewarrior imports"]
      );
    });

    it("should handle very long project names", async () => {
      const longProjectName = "A".repeat(255); // Max length
      const mockProject = {
        id: 6,
        projectName: longProjectName,
        description: "Auto-generated project for timewarrior imports",
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProject],
        rowCount: 1,
      });

      const result = await createProject(mockPool, longProjectName);

      expect(result).toEqual(mockProject);
    });

    it("should reject project names exceeding maximum length", async () => {
      const tooLongProjectName = "A".repeat(256); // Over max length

      await expect(createProject(mockPool, tooLongProjectName)).rejects.toThrow(
        "Project name exceeds maximum length of 255 characters"
      );
    });
  });

  describe("ensureProjectExists", () => {
    it("should return existing project if found", async () => {
      const existingProject = {
        id: 1,
        projectName: "CODING",
        description: "Auto-generated project for timewarrior imports",
      };

      // Mock findProjectByName to return existing project
      mockPool.query.mockResolvedValueOnce({
        rows: [existingProject],
        rowCount: 1,
      });

      const result = await ensureProjectExists(mockPool, "CODING");

      expect(result).toEqual(existingProject);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM timewplus_projects WHERE "projectName" = $1',
        ["CODING"]
      );
    });

    it("should create new project if not found", async () => {
      const newProject = {
        id: 2,
        projectName: "NEWPROJECT",
        description: "Auto-generated project for timewarrior imports",
      };

      // Mock findProjectByName to return null (not found)
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Mock createProject to return new project
      mockPool.query.mockResolvedValueOnce({
        rows: [newProject],
        rowCount: 1,
      });

      const result = await ensureProjectExists(mockPool, "NEWPROJECT");

      expect(result).toEqual(newProject);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it("should return project ID for foreign key assignment", async () => {
      const project = {
        id: 42,
        projectName: "TESTING",
        description: "Auto-generated project for timewarrior imports",
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [project],
        rowCount: 1,
      });

      const result = await ensureProjectExists(mockPool, "TESTING");

      expect(result.id).toBe(42);
      expect(typeof result.id).toBe("number");
    });

    it("should handle case-sensitive uniqueness", async () => {
      // First call for "CODING"
      const codingProject = {
        id: 1,
        projectName: "CODING",
        description: "Auto-generated project for timewarrior imports",
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [codingProject],
        rowCount: 1,
      });

      const result1 = await ensureProjectExists(mockPool, "CODING");

      // Second call for "coding" (lowercase) - should be treated as different
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const newCodingProject = {
        id: 2,
        projectName: "coding",
        description: "Auto-generated project for timewarrior imports",
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [newCodingProject],
        rowCount: 1,
      });

      const result2 = await ensureProjectExists(mockPool, "coding");

      expect(result1.id).toBe(1);
      expect(result1.projectName).toBe("CODING");
      expect(result2.id).toBe(2);
      expect(result2.projectName).toBe("coding");
    });

    it("should handle transaction failures gracefully", async () => {
      const dbError = new Error("Transaction failed");

      mockPool.query.mockRejectedValue(dbError);

      await expect(
        ensureProjectExists(mockPool, "FAILPROJECT")
      ).rejects.toThrow("Transaction failed");
    });
  });

  describe("generateProjectDescription", () => {
    it("should generate default description for auto-generated projects", () => {
      const description = generateProjectDescription("CODING");
      expect(description).toBe(
        "Auto-generated project for timewarrior imports"
      );
    });

    it("should generate same description regardless of project name", () => {
      const desc1 = generateProjectDescription("WORK");
      const desc2 = generateProjectDescription("LEARNING");
      const desc3 = generateProjectDescription("MEETING");

      expect(desc1).toBe(desc2);
      expect(desc2).toBe(desc3);
      expect(desc1).toBe("Auto-generated project for timewarrior imports");
    });

    it("should handle empty and null project names", () => {
      expect(generateProjectDescription("")).toBe(
        "Auto-generated project for timewarrior imports"
      );
      expect(generateProjectDescription(null)).toBe(
        "Auto-generated project for timewarrior imports"
      );
      expect(generateProjectDescription(undefined)).toBe(
        "Auto-generated project for timewarrior imports"
      );
    });
  });

  describe("getAllProjects", () => {
    it("should return all projects ordered by creation date", async () => {
      const mockProjects = [
        {
          id: 1,
          projectName: "DEFAULT",
          description: "Default project for entries without specific project",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          projectName: "CODING",
          description: "Auto-generated project for timewarrior imports",
          created_at: "2026-01-14T10:00:00.000Z",
        },
        {
          id: 3,
          projectName: "LEARNING",
          description: "Auto-generated project for timewarrior imports",
          created_at: "2026-01-14T11:00:00.000Z",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: mockProjects,
        rowCount: 3,
      });

      const result = await getAllProjects(mockPool);

      expect(result).toEqual(mockProjects);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM timewplus_projects ORDER BY created_at ASC"
      );
    });

    it("should return empty array when no projects exist", async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await getAllProjects(mockPool);

      expect(result).toEqual([]);
    });

    it("should handle database query errors", async () => {
      const dbError = new Error("Database query failed");
      mockPool.query.mockRejectedValue(dbError);

      await expect(getAllProjects(mockPool)).rejects.toThrow(
        "Database query failed"
      );
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle DEFAULT project creation consistently", async () => {
      const defaultProject = {
        id: 1,
        projectName: "DEFAULT",
        description: "Auto-generated project for timewarrior imports",
      };

      // First check if DEFAULT exists
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Then create DEFAULT project
      mockPool.query.mockResolvedValueOnce({
        rows: [defaultProject],
        rowCount: 1,
      });

      const result = await ensureProjectExists(mockPool, "DEFAULT");

      expect(result).toEqual(defaultProject);
      expect(result.projectName).toBe("DEFAULT");
    });

    it("should handle concurrent project creation attempts", async () => {
      // Simulate race condition where project gets created between check and insert
      const duplicateError = new Error(
        'duplicate key value violates unique constraint "timewplus_projects_projectName_key"'
      );
      duplicateError.code = "23505";

      // First check - project not found
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // Insert fails due to concurrent creation
      mockPool.query.mockRejectedValueOnce(duplicateError);

      await expect(ensureProjectExists(mockPool, "CONCURRENT")).rejects.toThrow(
        'Project "CONCURRENT" already exists'
      );
    });

    it("should handle batch project creation for multiple unique names", async () => {
      const projectNames = ["CODING", "TESTING", "MEETINGS"];
      const results = [];

      for (let i = 0; i < projectNames.length; i++) {
        const projectName = projectNames[i];
        const mockProject = {
          id: i + 1,
          projectName: projectName,
          description: "Auto-generated project for timewarrior imports",
        };

        // Mock not found, then create
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        });

        mockPool.query.mockResolvedValueOnce({
          rows: [mockProject],
          rowCount: 1,
        });

        const result = await ensureProjectExists(mockPool, projectName);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results[0].projectName).toBe("CODING");
      expect(results[1].projectName).toBe("TESTING");
      expect(results[2].projectName).toBe("MEETINGS");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should validate pool parameter", async () => {
      await expect(findProjectByName(null, "TEST")).rejects.toThrow(
        "Database pool is required"
      );

      await expect(createProject(undefined, "TEST")).rejects.toThrow(
        "Database pool is required"
      );

      await expect(ensureProjectExists(null, "TEST")).rejects.toThrow(
        "Database pool is required"
      );
    });

    it("should handle malformed database responses", async () => {
      // Missing rows property
      mockPool.query.mockResolvedValue({
        rowCount: 0,
      });

      await expect(findProjectByName(mockPool, "TEST")).rejects.toThrow(
        "Invalid database response"
      );
    });

    it("should handle unexpected database return values", async () => {
      // Multiple rows for unique constraint (should not happen)
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 1, projectName: "TEST" },
          { id: 2, projectName: "TEST" },
        ],
        rowCount: 2,
      });

      await expect(findProjectByName(mockPool, "TEST")).rejects.toThrow(
        "Multiple projects found with same name"
      );
    });
  });
});
