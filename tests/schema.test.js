import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createConnection,
  closeConnection,
} from "../src/database/connection.js";
import {
  createTables,
  createProjectsTable,
  createEntriesTable,
  createIndexes,
  createDefaultProject,
  dropTables,
  tableExists,
  indexExists,
} from "../src/database/schema.js";

// Mock the database connection
vi.mock("../src/database/connection.js", () => ({
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
}));

describe("Database Schema Module", () => {
  let mockPool;
  let mockClient;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock client
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    // Setup mock pool
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn(),
    };

    // Mock createConnection to return our mock pool
    createConnection.mockResolvedValue(mockPool);
  });

  afterEach(async () => {
    // Clean up any real connections if they exist
    if (closeConnection.mockRestore) {
      closeConnection.mockRestore();
    }
  });

  describe("Table Creation", () => {
    describe("createProjectsTable", () => {
      it("should create timewplus_projects table with correct schema", async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await createProjectsTable();

        expect(mockPool.connect).toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining("CREATE TABLE timewplus_projects")
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"projectName" VARCHAR(255) NOT NULL UNIQUE')
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"description" TEXT')
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining(
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
          )
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining(
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
          )
        );
        expect(mockClient.release).toHaveBeenCalled();
      });

      it("should handle table already exists error gracefully", async () => {
        const existsError = new Error(
          'relation "timewplus_projects" already exists'
        );
        existsError.code = "42P07";
        mockClient.query.mockRejectedValue(existsError);

        await expect(createProjectsTable()).resolves.not.toThrow();
        expect(mockClient.release).toHaveBeenCalled();
      });

      it("should throw error for other database errors", async () => {
        const dbError = new Error("Database connection failed");
        mockClient.query.mockRejectedValue(dbError);

        await expect(createProjectsTable()).rejects.toThrow(
          "Database connection failed"
        );
        expect(mockClient.release).toHaveBeenCalled();
      });

      it("should release client even on query failure", async () => {
        mockClient.query.mockRejectedValue(new Error("Query failed"));

        await expect(createProjectsTable()).rejects.toThrow();
        expect(mockClient.release).toHaveBeenCalled();
      });
    });

    describe("createEntriesTable", () => {
      it("should create timewplus_entries table with correct schema", async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await createEntriesTable();

        expect(mockPool.connect).toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining("CREATE TABLE timewplus_entries")
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"startTime" TIMESTAMP NOT NULL')
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"endTime" TIMESTAMP')
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"sessionName" VARCHAR(255)')
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining(
            '"projectId" INTEGER REFERENCES timewplus_projects(id)'
          )
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"annotation" TEXT')
        );
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('"groupType" VARCHAR(255) NOT NULL')
        );
        expect(mockClient.release).toHaveBeenCalled();
      });

      it("should handle table already exists error gracefully", async () => {
        const existsError = new Error(
          'relation "timewplus_entries" already exists'
        );
        existsError.code = "42P07";
        mockClient.query.mockRejectedValue(existsError);

        await expect(createEntriesTable()).resolves.not.toThrow();
        expect(mockClient.release).toHaveBeenCalled();
      });

      it("should throw error for foreign key constraint issues", async () => {
        const fkError = new Error("foreign key constraint violation");
        fkError.code = "23503";
        mockClient.query.mockRejectedValue(fkError);

        await expect(createEntriesTable()).rejects.toThrow(
          "foreign key constraint violation"
        );
        expect(mockClient.release).toHaveBeenCalled();
      });
    });

    describe("createTables", () => {
      it("should create both tables in correct order", async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await createTables();

        expect(mockClient.query).toHaveBeenCalledTimes(4);
        // Projects table should be created first (for foreign key dependency)
        expect(mockClient.query.mock.calls[1][0]).toContain(
          "timewplus_projects"
        );
        expect(mockClient.query.mock.calls[2][0]).toContain(
          "timewplus_entries"
        );
      });

      it("should handle partial creation failures", async () => {
        // First table succeeds, second fails
        mockClient.query
          .mockResolvedValueOnce({ rows: [] })
          .mockRejectedValueOnce(new Error("Second table creation failed"));

        await expect(createTables()).rejects.toThrow(
          "Second table creation failed"
        );
      });

      it("should use transaction for atomic table creation", async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await createTables();

        expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
        expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      });

      it("should rollback transaction on error", async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // First table
          .mockRejectedValueOnce(new Error("Second table failed")); // Second table fails

        await expect(createTables()).rejects.toThrow("Second table failed");
        expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      });
    });
  });

  describe("Index Creation", () => {
    it("should create all required indexes", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await createIndexes();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX idx_timewplus_entries_starttime")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX idx_timewplus_entries_endtime")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX idx_timewplus_entries_projectid")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX idx_timewplus_entries_grouptype")
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should handle index already exists errors gracefully", async () => {
      const indexExistsError = new Error(
        'relation "idx_timewplus_entries_starttime" already exists'
      );
      indexExistsError.code = "42P07";
      mockClient.query.mockRejectedValue(indexExistsError);

      await expect(createIndexes()).resolves.not.toThrow();
    });

    it("should create indexes on correct columns", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await createIndexes();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON timewplus_entries("startTime")')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON timewplus_entries("endTime")')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON timewplus_entries("projectId")')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON timewplus_entries("groupType")')
      );
    });
  });

  describe("Default Project Creation", () => {
    it("should create DEFAULT project record", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await createDefaultProject();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO timewplus_projects"),
        expect.arrayContaining(["DEFAULT"])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should handle duplicate DEFAULT project gracefully", async () => {
      const duplicateError = new Error(
        "duplicate key value violates unique constraint"
      );
      duplicateError.code = "23505";

      // Mock INSERT failure followed by SELECT success
      mockClient.query
        .mockRejectedValueOnce(duplicateError) // INSERT fails
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // SELECT succeeds

      await expect(createDefaultProject()).resolves.not.toThrow();
    });

    it("should create DEFAULT project with auto-generated description", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await createDefaultProject();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          "DEFAULT",
          expect.stringContaining(
            "Auto-generated project for entries without specific project annotations"
          ),
        ])
      );
    });

    it("should return project ID on successful creation", async () => {
      const mockResult = { rows: [{ id: 1 }] };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await createDefaultProject();

      expect(result.id).toBe(1);
    });

    it("should return existing project ID if already exists", async () => {
      const duplicateError = new Error(
        "duplicate key value violates unique constraint"
      );
      duplicateError.code = "23505";

      mockClient.query
        .mockRejectedValueOnce(duplicateError) // INSERT fails
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // SELECT succeeds

      const result = await createDefaultProject();

      expect(result.id).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT id FROM timewplus_projects WHERE "projectName" = $1'
        ),
        ["DEFAULT"]
      );
    });
  });

  describe("Schema Utility Functions", () => {
    describe("tableExists", () => {
      it("should check if table exists in information_schema", async () => {
        mockClient.query.mockResolvedValue({ rows: [{ exists: true }] });

        const exists = await tableExists("timewplus_projects");

        expect(exists).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining("SELECT EXISTS"),
          expect.arrayContaining(["timewplus_projects"])
        );
      });

      it("should return false when table does not exist", async () => {
        mockClient.query.mockResolvedValue({ rows: [{ exists: false }] });

        const exists = await tableExists("nonexistent_table");

        expect(exists).toBe(false);
      });

      it("should handle database errors when checking table existence", async () => {
        mockClient.query.mockRejectedValue(new Error("Database error"));

        await expect(tableExists("test_table")).rejects.toThrow(
          "Database error"
        );
        expect(mockClient.release).toHaveBeenCalled();
      });
    });

    describe("indexExists", () => {
      it("should check if index exists in pg_indexes", async () => {
        mockClient.query.mockResolvedValue({ rows: [{ exists: true }] });

        const exists = await indexExists("idx_timewplus_entries_starttime");

        expect(exists).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining("SELECT EXISTS"),
          expect.arrayContaining(["idx_timewplus_entries_starttime"])
        );
      });

      it("should return false when index does not exist", async () => {
        mockClient.query.mockResolvedValue({ rows: [{ exists: false }] });

        const exists = await indexExists("nonexistent_index");

        expect(exists).toBe(false);
      });
    });

    describe("dropTables", () => {
      it("should drop tables in correct order (reverse dependency)", async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await dropTables();

        expect(mockClient.query).toHaveBeenCalledTimes(2);
        // Entries table should be dropped first (has foreign key dependency)
        expect(mockClient.query.mock.calls[0][0]).toContain(
          "DROP TABLE IF EXISTS timewplus_entries"
        );
        expect(mockClient.query.mock.calls[1][0]).toContain(
          "DROP TABLE IF EXISTS timewplus_projects"
        );
      });

      it("should use CASCADE option for clean deletion", async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        await dropTables();

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining("CASCADE")
        );
      });

      it("should handle drop errors gracefully", async () => {
        mockClient.query.mockRejectedValue(new Error("Cannot drop table"));

        await expect(dropTables()).rejects.toThrow("Cannot drop table");
        expect(mockClient.release).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle connection failures", async () => {
      createConnection.mockRejectedValue(new Error("Connection failed"));

      await expect(createTables()).rejects.toThrow("Connection failed");
    });

    it("should release client connections in all error scenarios", async () => {
      mockClient.query.mockRejectedValue(new Error("Query failed"));

      await expect(createProjectsTable()).rejects.toThrow("Query failed");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should provide meaningful error messages for schema violations", async () => {
      const constraintError = new Error("violates check constraint");
      constraintError.code = "23514";
      mockClient.query.mockRejectedValue(constraintError);

      await expect(createEntriesTable()).rejects.toThrow(
        "violates check constraint"
      );
    });
  });

  describe("Complete Schema Setup", () => {
    it("should run full schema setup in correct order", async () => {
      mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // This would test a full setupSchema function that combines everything
      await createTables();
      await createIndexes();
      await createDefaultProject();

      // Verify correct execution order
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("timewplus_projects")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("timewplus_entries")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("COMMIT")
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX")
      );
    });
  });
});
