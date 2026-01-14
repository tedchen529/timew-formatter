import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkDateRangeOverlap,
  hasEntriesInDateRange,
  validateDateRange,
  blockInsertionIfOverlap,
  getOverlapDetails,
  formatOverlapError,
} from "../src/database/duplicates.js";

// Mock the database connection
vi.mock("../src/database/connection.js", () => ({
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
}));

describe("Duplicate Detection Module", () => {
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

  describe("hasEntriesInDateRange", () => {
    it("should return true when entries exist in date range", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ count: "3" }],
        rowCount: 1,
      });

      const result = await hasEntriesInDateRange(
        mockPool,
        "2026-01-10T00:00:00Z",
        "2026-01-12T23:59:59Z"
      );

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM timewplus_entries WHERE "startTime" >= $1 AND "startTime" <= $2',
        ["2026-01-10T00:00:00Z", "2026-01-12T23:59:59Z"]
      );
    });

    it("should return false when no entries exist in date range", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ count: "0" }],
        rowCount: 1,
      });

      const result = await hasEntriesInDateRange(
        mockPool,
        "2026-01-15T00:00:00Z",
        "2026-01-16T23:59:59Z"
      );

      expect(result).toBe(false);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM timewplus_entries WHERE "startTime" >= $1 AND "startTime" <= $2',
        ["2026-01-15T00:00:00Z", "2026-01-16T23:59:59Z"]
      );
    });

    it("should handle single date range", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ count: "1" }],
        rowCount: 1,
      });

      const singleDate = "2026-01-14T10:00:00Z";
      const result = await hasEntriesInDateRange(
        mockPool,
        singleDate,
        singleDate
      );

      expect(result).toBe(true);
    });

    it("should validate date parameters", async () => {
      await expect(
        hasEntriesInDateRange(mockPool, null, "2026-01-14")
      ).rejects.toThrow("Start date is required");

      await expect(
        hasEntriesInDateRange(mockPool, "2026-01-14", null)
      ).rejects.toThrow("End date is required");

      await expect(
        hasEntriesInDateRange(mockPool, "", "2026-01-14")
      ).rejects.toThrow("Start date is required");
    });

    it("should validate pool parameter", async () => {
      await expect(
        hasEntriesInDateRange(null, "2026-01-14", "2026-01-14")
      ).rejects.toThrow("Database pool is required");
    });

    it("should handle database query errors", async () => {
      const dbError = new Error("Database connection failed");
      mockPool.query.mockRejectedValue(dbError);

      await expect(
        hasEntriesInDateRange(
          mockPool,
          "2026-01-14T00:00:00Z",
          "2026-01-14T23:59:59Z"
        )
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("checkDateRangeOverlap", () => {
    it("should detect overlapping entries with startTime and endTime", async () => {
      const existingEntries = [
        {
          id: 1,
          startTime: "2026-01-14T09:00:00Z",
          endTime: "2026-01-14T12:00:00Z",
          sessionName: "work",
        },
        {
          id: 2,
          startTime: "2026-01-14T14:00:00Z",
          endTime: "2026-01-14T17:00:00Z",
          sessionName: "coding",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: existingEntries,
        rowCount: 2,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z", // Overlaps with first entry
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "meeting",
        },
      ];

      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.hasOverlap).toBe(true);
      expect(result.overlaps).toHaveLength(1);
      expect(result.overlaps[0]).toMatchObject({
        newEntry: newEntries[0],
        existingEntry: existingEntries[0],
        overlapType: "time_overlap",
      });
    });

    it("should detect no overlap when times do not conflict", async () => {
      const existingEntries = [
        {
          id: 1,
          startTime: "2026-01-14T09:00:00Z",
          endTime: "2026-01-14T10:00:00Z",
          sessionName: "work",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: existingEntries,
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T11:00:00Z", // No overlap
          endTime: "2026-01-14T12:00:00Z",
          sessionName: "meeting",
        },
      ];

      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.hasOverlap).toBe(false);
      expect(result.overlaps).toHaveLength(0);
    });

    it("should handle ongoing entries without endTime", async () => {
      const existingEntries = [
        {
          id: 1,
          startTime: "2026-01-14T09:00:00Z",
          endTime: null, // Ongoing entry
          sessionName: "work",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: existingEntries,
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z",
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "meeting",
        },
      ];

      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.hasOverlap).toBe(true);
      expect(result.overlaps[0].overlapType).toBe("ongoing_conflict");
    });

    it("should handle multiple overlapping entries", async () => {
      const existingEntries = [
        {
          id: 1,
          startTime: "2026-01-14T09:00:00Z",
          endTime: "2026-01-14T12:00:00Z",
          sessionName: "work1",
        },
        {
          id: 2,
          startTime: "2026-01-14T14:00:00Z",
          endTime: "2026-01-14T17:00:00Z",
          sessionName: "work2",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: existingEntries,
        rowCount: 2,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z", // Overlaps with first
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "meeting1",
        },
        {
          startTime: "2026-01-14T15:00:00Z", // Overlaps with second
          endTime: "2026-01-14T16:00:00Z",
          sessionName: "meeting2",
        },
      ];

      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.hasOverlap).toBe(true);
      expect(result.overlaps).toHaveLength(2);
    });

    it("should handle edge case: exact time boundaries", async () => {
      const existingEntries = [
        {
          id: 1,
          startTime: "2026-01-14T09:00:00Z",
          endTime: "2026-01-14T10:00:00Z",
          sessionName: "work",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: existingEntries,
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z", // Starts exactly when previous ends
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "meeting",
        },
      ];

      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.hasOverlap).toBe(false); // No overlap if times are adjacent
    });

    it("should handle empty new entries array", async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        []
      );

      expect(result.hasOverlap).toBe(false);
      expect(result.overlaps).toHaveLength(0);
    });
  });

  describe("blockInsertionIfOverlap", () => {
    it("should block insertion when overlap exists", async () => {
      // Mock hasEntriesInDateRange to return true
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: "1" }],
        rowCount: 1,
      });

      // Mock checkDateRangeOverlap to return overlap details
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            startTime: "2026-01-14T09:00:00Z",
            endTime: "2026-01-14T12:00:00Z",
            sessionName: "existing",
          },
        ],
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z",
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "new",
        },
      ];

      await expect(
        blockInsertionIfOverlap(
          mockPool,
          "2026-01-14T00:00:00Z",
          "2026-01-14T23:59:59Z",
          newEntries
        )
      ).rejects.toThrow(/Insertion blocked.*overlap.*detected/);
    });

    it("should allow insertion when no overlap exists", async () => {
      // Mock hasEntriesInDateRange to return false
      mockPool.query.mockResolvedValue({
        rows: [{ count: "0" }],
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z",
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "new",
        },
      ];

      await expect(
        blockInsertionIfOverlap(
          mockPool,
          "2026-01-14T00:00:00Z",
          "2026-01-14T23:59:59Z",
          newEntries
        )
      ).resolves.toBeUndefined();
    });

    it("should provide detailed error message for overlaps", async () => {
      // Mock overlap detection
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: "1" }],
        rowCount: 1,
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            startTime: "2026-01-14T09:00:00Z",
            endTime: "2026-01-14T12:00:00Z",
            sessionName: "existing_work",
            annotation: "Important meeting",
          },
        ],
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z",
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "new_meeting",
          annotation: "Team standup",
        },
      ];

      try {
        await blockInsertionIfOverlap(
          mockPool,
          "2026-01-14T00:00:00Z",
          "2026-01-14T23:59:59Z",
          newEntries
        );
      } catch (error) {
        expect(error.message).toContain("existing_work");
        expect(error.message).toContain("new_meeting");
        expect(error.message).toContain("09:00");
        expect(error.message).toContain("12:00");
      }
    });
  });

  describe("getOverlapDetails", () => {
    it("should return detailed overlap information", async () => {
      const existingEntries = [
        {
          id: 1,
          startTime: "2026-01-14T09:00:00Z",
          endTime: "2026-01-14T12:00:00Z",
          sessionName: "work",
          annotation: "Daily tasks",
        },
      ];

      mockPool.query.mockResolvedValue({
        rows: existingEntries,
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:00:00Z",
          endTime: "2026-01-14T11:00:00Z",
          sessionName: "meeting",
          annotation: "Team sync",
        },
      ];

      const result = await getOverlapDetails(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result).toHaveProperty("dateRange");
      expect(result).toHaveProperty("existingCount");
      expect(result).toHaveProperty("newEntriesCount");
      expect(result).toHaveProperty("overlaps");
      expect(result.existingCount).toBe(1);
      expect(result.newEntriesCount).toBe(1);
      expect(result.overlaps).toHaveLength(1);
    });

    it("should handle timezone information in overlap details", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            startTime: "2026-01-14T01:00:00Z", // UTC time
            endTime: "2026-01-14T04:00:00Z",
            sessionName: "work",
          },
        ],
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T02:00:00Z",
          endTime: "2026-01-14T03:00:00Z",
          sessionName: "meeting",
        },
      ];

      const result = await getOverlapDetails(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.overlaps[0]).toHaveProperty("taipeiTimes");
      expect(result.overlaps[0].taipeiTimes).toHaveProperty("existingStart");
      expect(result.overlaps[0].taipeiTimes).toHaveProperty("existingEnd");
      expect(result.overlaps[0].taipeiTimes).toHaveProperty("newStart");
      expect(result.overlaps[0].taipeiTimes).toHaveProperty("newEnd");
    });
  });

  describe("formatOverlapError", () => {
    it("should format single overlap error message", () => {
      const overlapDetails = {
        dateRange: {
          start: "2026-01-14T00:00:00Z",
          end: "2026-01-14T23:59:59Z",
        },
        existingCount: 1,
        newEntriesCount: 1,
        overlaps: [
          {
            newEntry: {
              startTime: "2026-01-14T10:00:00Z",
              endTime: "2026-01-14T11:00:00Z",
              sessionName: "meeting",
            },
            existingEntry: {
              startTime: "2026-01-14T09:00:00Z",
              endTime: "2026-01-14T12:00:00Z",
              sessionName: "work",
            },
            overlapType: "time_overlap",
          },
        ],
      };

      const errorMessage = formatOverlapError(overlapDetails);

      expect(errorMessage).toContain("Insertion blocked");
      expect(errorMessage).toContain("1 overlap detected");
      expect(errorMessage).toContain("meeting");
      expect(errorMessage).toContain("work");
      expect(errorMessage).toContain("10:00");
      expect(errorMessage).toContain("09:00");
    });

    it("should format multiple overlap error message", () => {
      const overlapDetails = {
        dateRange: {
          start: "2026-01-14T00:00:00Z",
          end: "2026-01-14T23:59:59Z",
        },
        existingCount: 2,
        newEntriesCount: 2,
        overlaps: [
          {
            newEntry: {
              sessionName: "meeting1",
              startTime: "2026-01-14T10:00:00Z",
            },
            existingEntry: {
              sessionName: "work1",
              startTime: "2026-01-14T09:00:00Z",
            },
            overlapType: "time_overlap",
          },
          {
            newEntry: {
              sessionName: "meeting2",
              startTime: "2026-01-14T15:00:00Z",
            },
            existingEntry: {
              sessionName: "work2",
              startTime: "2026-01-14T14:00:00Z",
            },
            overlapType: "time_overlap",
          },
        ],
      };

      const errorMessage = formatOverlapError(overlapDetails);

      expect(errorMessage).toContain("2 overlaps detected");
      expect(errorMessage).toContain("meeting1");
      expect(errorMessage).toContain("meeting2");
    });

    it("should include helpful instructions in error message", () => {
      const overlapDetails = {
        dateRange: {
          start: "2026-01-14T00:00:00Z",
          end: "2026-01-14T23:59:59Z",
        },
        existingCount: 1,
        newEntriesCount: 1,
        overlaps: [
          {
            newEntry: {
              sessionName: "test",
              startTime: "2026-01-14T10:00:00Z",
            },
            existingEntry: {
              sessionName: "existing",
              startTime: "2026-01-14T09:00:00Z",
            },
            overlapType: "time_overlap",
          },
        ],
      };

      const errorMessage = formatOverlapError(overlapDetails);

      expect(errorMessage).toContain("Please resolve conflicts");
      expect(errorMessage).toContain("different date range");
    });
  });

  describe("validateDateRange", () => {
    it("should validate correct date range", () => {
      expect(() =>
        validateDateRange("2026-01-14T00:00:00Z", "2026-01-14T23:59:59Z")
      ).not.toThrow();
    });

    it("should reject invalid date formats", () => {
      expect(() =>
        validateDateRange("invalid", "2026-01-14T23:59:59Z")
      ).toThrow("Invalid start date format");

      expect(() =>
        validateDateRange("2026-01-14T00:00:00Z", "invalid")
      ).toThrow("Invalid end date format");
    });

    it("should reject start date after end date", () => {
      expect(() =>
        validateDateRange("2026-01-15T00:00:00Z", "2026-01-14T00:00:00Z")
      ).toThrow("Start date must be before or equal to end date");
    });

    it("should allow same start and end date", () => {
      expect(() =>
        validateDateRange("2026-01-14T10:00:00Z", "2026-01-14T10:00:00Z")
      ).not.toThrow();
    });

    it("should handle null and undefined dates", () => {
      expect(() => validateDateRange(null, "2026-01-14T00:00:00Z")).toThrow(
        "Start date is required"
      );

      expect(() => validateDateRange("2026-01-14T00:00:00Z", null)).toThrow(
        "End date is required"
      );
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle large date ranges with many entries", async () => {
      // Mock many existing entries
      const manyEntries = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        startTime: `2026-01-${String(10 + i).padStart(2, "0")}T09:00:00Z`,
        endTime: `2026-01-${String(10 + i).padStart(2, "0")}T17:00:00Z`,
        sessionName: `work_${i}`,
      }));

      mockPool.query.mockResolvedValue({
        rows: [{ count: "100" }],
        rowCount: 1,
      });

      const result = await hasEntriesInDateRange(
        mockPool,
        "2026-01-01T00:00:00Z",
        "2026-12-31T23:59:59Z"
      );

      expect(result).toBe(true);
    });

    it("should handle concurrent overlap detection", async () => {
      // Mock the query to return entries that should overlap
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            startTime: "2026-01-14T10:00:00Z",
            endTime: "2026-01-14T11:00:00Z",
            sessionName: "concurrent",
          },
        ],
        rowCount: 1,
      });

      const newEntries = [
        {
          startTime: "2026-01-14T10:30:00Z",
          endTime: "2026-01-14T11:30:00Z",
          sessionName: "test",
        },
      ];

      // Should detect the overlap between 10:30-11:30 and 10:00-11:00
      const result = await checkDateRangeOverlap(
        mockPool,
        "2026-01-14T00:00:00Z",
        "2026-01-14T23:59:59Z",
        newEntries
      );

      expect(result.hasOverlap).toBe(true);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle database connection failures", async () => {
      const dbError = new Error("Connection timeout");
      mockPool.query.mockRejectedValue(dbError);

      await expect(
        hasEntriesInDateRange(
          mockPool,
          "2026-01-14T00:00:00Z",
          "2026-01-14T23:59:59Z"
        )
      ).rejects.toThrow("Connection timeout");
    });

    it("should handle malformed database responses", async () => {
      mockPool.query.mockResolvedValue({
        rows: null, // Malformed response
        rowCount: 0,
      });

      await expect(
        hasEntriesInDateRange(
          mockPool,
          "2026-01-14T00:00:00Z",
          "2026-01-14T23:59:59Z"
        )
      ).rejects.toThrow("Invalid database response");
    });

    it("should handle very large overlap counts", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ count: "999999" }], // Very large number
        rowCount: 1,
      });

      const result = await hasEntriesInDateRange(
        mockPool,
        "2026-01-01T00:00:00Z",
        "2026-12-31T23:59:59Z"
      );

      expect(result).toBe(true);
    });

    it("should validate pool parameter across all functions", async () => {
      const testParams = ["2026-01-14T00:00:00Z", "2026-01-14T23:59:59Z", []];

      await expect(
        hasEntriesInDateRange(null, ...testParams.slice(0, 2))
      ).rejects.toThrow("Database pool is required");

      await expect(checkDateRangeOverlap(null, ...testParams)).rejects.toThrow(
        "Database pool is required"
      );

      await expect(
        blockInsertionIfOverlap(null, ...testParams)
      ).rejects.toThrow("Database pool is required");

      await expect(getOverlapDetails(null, ...testParams)).rejects.toThrow(
        "Database pool is required"
      );
    });
  });
});
