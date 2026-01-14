import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  insertEntries,
  insertEntry,
  mapTimewarriorToEntry,
  validateEntry,
  rollbackTransaction,
} from "../src/database/entries.js";

// Mock the database connection
vi.mock("../src/database/connection.js", () => ({
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
}));

// Mock the duplicate detection module
vi.mock("../src/database/duplicates.js", () => ({
  checkForDuplicates: vi.fn(),
}));

describe("Entry Insertion Module", () => {
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

  describe("mapTimewarriorToEntry", () => {
    it("should map timewarrior entry with all fields to database entry", () => {
      const timewarriorEntry = {
        start: "20260114T020000Z",
        end: "20260114T030000Z",
        tags: ["session1", "work"],
        annotation: "CODING-Working on feature",
      };

      const expectedEntry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        annotation: "CODING-Working on feature",
      };

      const result = mapTimewarriorToEntry(timewarriorEntry);

      expect(result).toEqual(expectedEntry);
    });

    it("should handle entry with no end time (ongoing entry)", () => {
      const timewarriorEntry = {
        start: "20260114T020000Z",
        tags: ["session2"],
        annotation: "LEARNING-Reading documentation",
      };

      const expectedEntry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: null,
        sessionName: "session2",
        annotation: "LEARNING-Reading documentation",
      };

      const result = mapTimewarriorToEntry(timewarriorEntry);

      expect(result).toEqual(expectedEntry);
    });

    it("should handle entry with empty tags array", () => {
      const timewarriorEntry = {
        start: "20260114T020000Z",
        end: "20260114T030000Z",
        tags: [],
        annotation: "DEFAULT-Simple task",
      };

      const expectedEntry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: null,
        annotation: "DEFAULT-Simple task",
      };

      const result = mapTimewarriorToEntry(timewarriorEntry);

      expect(result).toEqual(expectedEntry);
    });

    it("should extract sessionName from first element of tags array", () => {
      const timewarriorEntry = {
        start: "20260114T020000Z",
        end: "20260114T030000Z",
        tags: ["primary-session", "secondary", "tertiary"],
        annotation: "WORK-Important meeting",
      };

      const result = mapTimewarriorToEntry(timewarriorEntry);

      expect(result.sessionName).toBe("primary-session");
    });

    it("should handle missing annotation field", () => {
      const timewarriorEntry = {
        start: "20260114T020000Z",
        end: "20260114T030000Z",
        tags: ["session1"],
      };

      const expectedEntry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        annotation: null,
      };

      const result = mapTimewarriorToEntry(timewarriorEntry);

      expect(result).toEqual(expectedEntry);
    });
  });

  describe("validateEntry", () => {
    it("should validate a complete entry with all required fields", () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      expect(() => validateEntry(entry)).not.toThrow();
    });

    it("should validate entry without endTime (ongoing entry)", () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: null,
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      expect(() => validateEntry(entry)).not.toThrow();
    });

    it("should throw error when startTime is missing", () => {
      const entry = {
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      expect(() => validateEntry(entry)).toThrow("startTime is required");
    });

    it("should throw error when projectId is missing", () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      expect(() => validateEntry(entry)).toThrow("projectId is required");
    });

    it("should throw error when groupType is missing", () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
      };

      expect(() => validateEntry(entry)).toThrow("groupType is required");
    });

    it("should throw error when endTime is before startTime", () => {
      const entry = {
        startTime: new Date("2026-01-14T03:00:00.000Z"),
        endTime: new Date("2026-01-14T02:00:00.000Z"),
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      expect(() => validateEntry(entry)).toThrow(
        "endTime must be after startTime"
      );
    });

    it("should allow null sessionName and annotation", () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: null,
        projectId: 1,
        annotation: null,
        groupType: "DEVELOPMENT",
      };

      expect(() => validateEntry(entry)).not.toThrow();
    });
  });

  describe("insertEntry", () => {
    it("should insert single entry with transaction", async () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      const mockResult = {
        rows: [{ id: 1, ...entry }],
        rowCount: 1,
      };

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
      mockClient.query.mockResolvedValueOnce(mockResult); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      const result = await insertEntry(mockPool, entry);

      expect(result).toEqual(mockResult.rows[0]);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectId", "annotation", "groupType") 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          entry.startTime,
          entry.endTime,
          entry.sessionName,
          entry.projectId,
          entry.annotation,
          entry.groupType,
        ]
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback transaction on insertion failure", async () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: new Date("2026-01-14T03:00:00.000Z"),
        sessionName: "session1",
        projectId: 1,
        annotation: "Working on feature",
        groupType: "DEVELOPMENT",
      };

      const insertError = new Error("Database constraint violation");

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
      mockClient.query.mockRejectedValueOnce(insertError); // INSERT fails
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

      await expect(insertEntry(mockPool, entry)).rejects.toThrow(
        "Database constraint violation"
      );

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should handle entry with null endTime", async () => {
      const entry = {
        startTime: new Date("2026-01-14T02:00:00.000Z"),
        endTime: null,
        sessionName: "session1",
        projectId: 1,
        annotation: "Ongoing task",
        groupType: "DEVELOPMENT",
      };

      const mockResult = {
        rows: [{ id: 1, ...entry }],
        rowCount: 1,
      };

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
      mockClient.query.mockResolvedValueOnce(mockResult); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      const result = await insertEntry(mockPool, entry);

      expect(result).toEqual(mockResult.rows[0]);
      expect(mockClient.query).toHaveBeenCalledWith(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectId", "annotation", "groupType") 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          entry.startTime,
          null,
          entry.sessionName,
          entry.projectId,
          entry.annotation,
          entry.groupType,
        ]
      );
    });
  });

  describe("insertEntries", () => {
    it("should insert multiple entries in a single transaction", async () => {
      const entries = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: new Date("2026-01-14T03:00:00.000Z"),
          sessionName: "session1",
          projectId: 1,
          annotation: "Task 1",
          groupType: "DEVELOPMENT",
        },
        {
          startTime: new Date("2026-01-14T04:00:00.000Z"),
          endTime: new Date("2026-01-14T05:00:00.000Z"),
          sessionName: "session2",
          projectId: 2,
          annotation: "Task 2",
          groupType: "DEVELOPMENT",
        },
      ];

      const mockResults = entries.map((entry, index) => ({
        rows: [{ id: index + 1, ...entry }],
        rowCount: 1,
      }));

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
      mockClient.query.mockResolvedValueOnce(mockResults[0]); // INSERT 1
      mockClient.query.mockResolvedValueOnce(mockResults[1]); // INSERT 2
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      const results = await insertEntries(mockPool, entries);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockResults[0].rows[0]);
      expect(results[1]).toEqual(mockResults[1].rows[0]);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback entire batch if any insertion fails", async () => {
      const entries = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: new Date("2026-01-14T03:00:00.000Z"),
          sessionName: "session1",
          projectId: 1,
          annotation: "Task 1",
          groupType: "DEVELOPMENT",
        },
        {
          startTime: new Date("2026-01-14T04:00:00.000Z"),
          endTime: new Date("2026-01-14T05:00:00.000Z"),
          sessionName: "session2",
          projectId: 999, // Invalid project ID
          annotation: "Task 2",
          groupType: "DEVELOPMENT",
        },
      ];

      const insertError = new Error("Foreign key constraint violation");

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...entries[0] }],
        rowCount: 1,
      }); // INSERT 1 success
      mockClient.query.mockRejectedValueOnce(insertError); // INSERT 2 fails
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

      await expect(insertEntries(mockPool, entries)).rejects.toThrow(
        "Foreign key constraint violation"
      );

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should validate all entries before starting transaction", async () => {
      const entries = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: new Date("2026-01-14T03:00:00.000Z"),
          sessionName: "session1",
          projectId: 1,
          annotation: "Task 1",
          groupType: "DEVELOPMENT",
        },
        {
          // Missing required startTime
          endTime: new Date("2026-01-14T05:00:00.000Z"),
          sessionName: "session2",
          projectId: 2,
          annotation: "Task 2",
          groupType: "DEVELOPMENT",
        },
      ];

      await expect(insertEntries(mockPool, entries)).rejects.toThrow(
        "startTime is required"
      );

      // Should not have started transaction
      expect(mockClient.query).not.toHaveBeenCalledWith("BEGIN");
    });

    it("should handle empty entries array", async () => {
      const entries = [];

      const results = await insertEntries(mockPool, entries);

      expect(results).toEqual([]);
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it("should include all entry fields in batch insertion", async () => {
      const entries = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: null, // Ongoing entry
          sessionName: null, // No session
          projectId: 1,
          annotation: null, // No annotation
          groupType: "LEARNING",
        },
      ];

      const mockResult = {
        rows: [{ id: 1, ...entries[0] }],
        rowCount: 1,
      };

      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
      mockClient.query.mockResolvedValueOnce(mockResult); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      const results = await insertEntries(mockPool, entries);

      expect(results).toHaveLength(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectId", "annotation", "groupType") 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          entries[0].startTime,
          null,
          null,
          entries[0].projectId,
          null,
          entries[0].groupType,
        ]
      );
    });
  });

  describe("rollbackTransaction", () => {
    it("should execute rollback command", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await rollbackTransaction(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should handle rollback failure gracefully", async () => {
      const rollbackError = new Error("Rollback failed");
      mockClient.query.mockRejectedValueOnce(rollbackError);

      // Should not throw but log the error (if logging is implemented)
      await expect(rollbackTransaction(mockClient)).rejects.toThrow(
        "Rollback failed"
      );
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complex timewarrior data mapping to database entries", () => {
      const timewarriorEntries = [
        {
          start: "20260114T020000Z",
          end: "20260114T030000Z",
          tags: ["dev-session", "urgent"],
          annotation: "CODING-Implementing user authentication",
        },
        {
          start: "20260114T040000Z",
          tags: ["meeting-session"],
          annotation: "MEETINGS-Daily standup discussion",
        },
        {
          start: "20260114T060000Z",
          end: "20260114T070000Z",
          tags: [],
          annotation: "Break time",
        },
      ];

      const expectedMappings = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: new Date("2026-01-14T03:00:00.000Z"),
          sessionName: "dev-session",
          annotation: "CODING-Implementing user authentication",
        },
        {
          startTime: new Date("2026-01-14T04:00:00.000Z"),
          endTime: null,
          sessionName: "meeting-session",
          annotation: "MEETINGS-Daily standup discussion",
        },
        {
          startTime: new Date("2026-01-14T06:00:00.000Z"),
          endTime: new Date("2026-01-14T07:00:00.000Z"),
          sessionName: null,
          annotation: "Break time",
        },
      ];

      const results = timewarriorEntries.map((entry) =>
        mapTimewarriorToEntry(entry)
      );

      expect(results).toEqual(expectedMappings);
    });

    it("should prepare entries for batch insertion with project resolution", async () => {
      const mappedEntries = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: new Date("2026-01-14T03:00:00.000Z"),
          sessionName: "session1",
          annotation: "CODING-Feature work",
        },
        {
          startTime: new Date("2026-01-14T04:00:00.000Z"),
          endTime: new Date("2026-01-14T05:00:00.000Z"),
          sessionName: "session2",
          annotation: "LEARNING-Reading docs",
        },
      ];

      const groupType = "DEVELOPMENT";
      const projectIds = { CODING: 1, LEARNING: 2 };

      // Simulate adding projectId and groupType to mapped entries
      const entriesForInsertion = mappedEntries.map((entry) => ({
        ...entry,
        projectId: projectIds[entry.annotation.split("-")[0]] || 3, // Default project
        groupType,
      }));

      const expectedEntries = [
        {
          startTime: new Date("2026-01-14T02:00:00.000Z"),
          endTime: new Date("2026-01-14T03:00:00.000Z"),
          sessionName: "session1",
          annotation: "CODING-Feature work",
          projectId: 1,
          groupType: "DEVELOPMENT",
        },
        {
          startTime: new Date("2026-01-14T04:00:00.000Z"),
          endTime: new Date("2026-01-14T05:00:00.000Z"),
          sessionName: "session2",
          annotation: "LEARNING-Reading docs",
          projectId: 2,
          groupType: "DEVELOPMENT",
        },
      ];

      expect(entriesForInsertion).toEqual(expectedEntries);
    });
  });
});
