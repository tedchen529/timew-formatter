import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateEntry,
  validateTimestampFormat,
  validateTimestampRange,
  filterTodayEntries,
  isValidTimeOrder,
  validateEntries,
} from "../src/utils/validation.js";

describe("Data Filtering & Validation", () => {
  let mockToday;

  beforeEach(() => {
    // Mock today's date consistently for all tests
    mockToday = new Date("2026-01-14T00:00:00Z"); // Current date from context
    vi.setSystemTime(mockToday);
  });

  describe("validateTimestampFormat", () => {
    it("should validate correct ISO timestamp with Z suffix", () => {
      const validTimestamp = "2026-01-13T08:30:00Z";
      expect(validateTimestampFormat(validTimestamp)).toBe(true);
    });

    it("should validate correct ISO timestamp with timezone offset", () => {
      const validTimestamp = "2026-01-13T16:30:00+08:00";
      expect(validateTimestampFormat(validTimestamp)).toBe(true);
    });

    it("should validate correct ISO timestamp without timezone", () => {
      const validTimestamp = "2026-01-13T08:30:00";
      expect(validateTimestampFormat(validTimestamp)).toBe(true);
    });

    it("should reject invalid date format", () => {
      const invalidTimestamp = "2026/01/13 08:30:00";
      expect(validateTimestampFormat(invalidTimestamp)).toBe(false);
    });

    it("should reject non-string timestamps", () => {
      expect(validateTimestampFormat(null)).toBe(false);
      expect(validateTimestampFormat(undefined)).toBe(false);
      expect(validateTimestampFormat(12345)).toBe(false);
      expect(validateTimestampFormat(new Date())).toBe(false);
    });

    it("should reject empty string", () => {
      expect(validateTimestampFormat("")).toBe(false);
    });

    it("should reject malformed ISO timestamps", () => {
      expect(validateTimestampFormat("2026-13-01T08:30:00Z")).toBe(false); // Invalid month
      expect(validateTimestampFormat("2026-01-32T08:30:00Z")).toBe(false); // Invalid day
      expect(validateTimestampFormat("2026-01-01T25:30:00Z")).toBe(false); // Invalid hour
      expect(validateTimestampFormat("2026-01-01T08:70:00Z")).toBe(false); // Invalid minute
    });
  });

  describe("validateTimestampRange", () => {
    it("should validate reasonable timestamp ranges", () => {
      const timestamp = "2026-01-13T08:30:00Z";
      expect(validateTimestampRange(timestamp)).toBe(true);
    });

    it("should reject timestamps too far in the future", () => {
      const futureTimestamp = "2030-01-01T00:00:00Z";
      expect(validateTimestampRange(futureTimestamp)).toBe(false);
    });

    it("should reject timestamps too far in the past", () => {
      const pastTimestamp = "2020-01-01T00:00:00Z";
      expect(validateTimestampRange(pastTimestamp)).toBe(false);
    });

    it("should accept timestamps from the configured START_DATE", () => {
      // Assuming START_DATE is around 2024-01-01
      const startDateTimestamp = "2024-01-01T00:00:00Z";
      expect(validateTimestampRange(startDateTimestamp)).toBe(true);
    });

    it("should handle invalid timestamps gracefully", () => {
      expect(validateTimestampRange("invalid-date")).toBe(false);
      expect(validateTimestampRange(null)).toBe(false);
      expect(validateTimestampRange(undefined)).toBe(false);
    });
  });

  describe("isValidTimeOrder", () => {
    it("should validate when startTime is before endTime", () => {
      const startTime = "2026-01-13T08:00:00Z";
      const endTime = "2026-01-13T09:00:00Z";
      expect(isValidTimeOrder(startTime, endTime)).toBe(true);
    });

    it("should validate when startTime equals endTime", () => {
      const timestamp = "2026-01-13T08:00:00Z";
      expect(isValidTimeOrder(timestamp, timestamp)).toBe(true);
    });

    it("should reject when startTime is after endTime", () => {
      const startTime = "2026-01-13T09:00:00Z";
      const endTime = "2026-01-13T08:00:00Z";
      expect(isValidTimeOrder(startTime, endTime)).toBe(false);
    });

    it("should handle missing endTime gracefully", () => {
      const startTime = "2026-01-13T08:00:00Z";
      expect(isValidTimeOrder(startTime, null)).toBe(true);
      expect(isValidTimeOrder(startTime, undefined)).toBe(true);
    });

    it("should handle missing startTime gracefully", () => {
      const endTime = "2026-01-13T08:00:00Z";
      expect(isValidTimeOrder(null, endTime)).toBe(true);
      expect(isValidTimeOrder(undefined, endTime)).toBe(true);
    });

    it("should handle both timestamps missing", () => {
      expect(isValidTimeOrder(null, null)).toBe(true);
      expect(isValidTimeOrder(undefined, undefined)).toBe(true);
    });

    it("should handle invalid timestamp formats", () => {
      expect(isValidTimeOrder("invalid", "2026-01-13T08:00:00Z")).toBe(false);
      expect(isValidTimeOrder("2026-01-13T08:00:00Z", "invalid")).toBe(false);
      expect(isValidTimeOrder("invalid1", "invalid2")).toBe(false);
    });
  });

  describe("validateEntry", () => {
    it("should validate a complete valid entry", () => {
      const validEntry = {
        id: 1,
        start: "2026-01-13T08:00:00Z",
        end: "2026-01-13T09:00:00Z",
        tags: ["WORK", "meeting"],
        annotation: "Team standup meeting",
      };
      expect(validateEntry(validEntry)).toBe(true);
    });

    it("should validate entry with only startTime", () => {
      const entryWithoutEnd = {
        id: 1,
        start: "2026-01-13T08:00:00Z",
        tags: ["WORK"],
        annotation: "Ongoing task",
      };
      expect(validateEntry(entryWithoutEnd)).toBe(true);
    });

    it("should reject entry with invalid startTime format", () => {
      const invalidEntry = {
        id: 1,
        start: "2026/01/13 08:00:00",
        end: "2026-01-13T09:00:00Z",
        tags: ["WORK"],
      };
      expect(validateEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with invalid endTime format", () => {
      const invalidEntry = {
        id: 1,
        start: "2026-01-13T08:00:00Z",
        end: "2026/01/13 09:00:00",
        tags: ["WORK"],
      };
      expect(validateEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with endTime before startTime", () => {
      const invalidEntry = {
        id: 1,
        start: "2026-01-13T09:00:00Z",
        end: "2026-01-13T08:00:00Z",
        tags: ["WORK"],
      };
      expect(validateEntry(invalidEntry)).toBe(false);
    });

    it("should reject entry with timestamps out of range", () => {
      const invalidEntry = {
        id: 1,
        start: "2030-01-13T08:00:00Z", // Too far in future
        end: "2030-01-13T09:00:00Z",
        tags: ["WORK"],
      };
      expect(validateEntry(invalidEntry)).toBe(false);
    });

    it("should handle entries without required fields", () => {
      expect(validateEntry({})).toBe(false);
      expect(validateEntry(null)).toBe(false);
      expect(validateEntry(undefined)).toBe(false);
    });

    it("should reject entry missing startTime", () => {
      const entryWithoutStart = {
        id: 1,
        end: "2026-01-13T09:00:00Z",
        tags: ["WORK"],
      };
      expect(validateEntry(entryWithoutStart)).toBe(false);
    });
  });

  describe("filterTodayEntries", () => {
    it("should filter out entries from today (incomplete data rule)", () => {
      const entries = [
        {
          id: 1,
          start: "2026-01-13T08:00:00Z", // Yesterday - should keep
          end: "2026-01-13T09:00:00Z",
          tags: ["WORK"],
        },
        {
          id: 2,
          start: "2026-01-14T08:00:00Z", // Today - should filter out
          end: "2026-01-14T09:00:00Z",
          tags: ["WORK"],
        },
        {
          id: 3,
          start: "2026-01-12T08:00:00Z", // Day before yesterday - should keep
          end: "2026-01-12T09:00:00Z",
          tags: ["WORK"],
        },
      ];

      const filtered = filterTodayEntries(entries);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((e) => e.id)).toEqual([1, 3]);
    });

    it("should filter out entries that start today even if they end yesterday", () => {
      const entries = [
        {
          id: 1,
          start: "2026-01-14T01:00:00Z", // Today UTC (but may be yesterday in Taipei)
          end: "2026-01-13T23:00:00Z", // This scenario shouldn't happen but test edge case
          tags: ["WORK"],
        },
      ];

      const filtered = filterTodayEntries(entries);
      expect(filtered).toHaveLength(0);
    });

    it("should handle entries without endTime", () => {
      const entries = [
        {
          id: 1,
          start: "2026-01-13T08:00:00Z", // Yesterday - should keep
          tags: ["WORK"],
        },
        {
          id: 2,
          start: "2026-01-14T08:00:00Z", // Today - should filter out
          tags: ["WORK"],
        },
      ];

      const filtered = filterTodayEntries(entries);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it("should handle timezone considerations (Taipei timezone)", () => {
      const entries = [
        {
          id: 1,
          start: "2026-01-13T20:00:00Z", // Yesterday 20:00 UTC = Today 04:00 Taipei - should filter
          tags: ["WORK"],
        },
        {
          id: 2,
          start: "2026-01-13T15:00:00Z", // Yesterday 15:00 UTC = Yesterday 23:00 Taipei - should keep
          tags: ["WORK"],
        },
      ];

      const filtered = filterTodayEntries(entries);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(2);
    });

    it("should handle empty arrays", () => {
      expect(filterTodayEntries([])).toEqual([]);
    });

    it("should handle invalid input gracefully", () => {
      expect(filterTodayEntries(null)).toEqual([]);
      expect(filterTodayEntries(undefined)).toEqual([]);
    });

    it("should handle entries with invalid dates", () => {
      const entries = [
        {
          id: 1,
          start: "invalid-date",
          tags: ["WORK"],
        },
        {
          id: 2,
          start: "2026-01-13T08:00:00Z", // Valid yesterday - should keep
          tags: ["WORK"],
        },
      ];

      const filtered = filterTodayEntries(entries);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(2);
    });
  });

  describe("validateEntries", () => {
    it("should validate and filter a mixed array of entries", () => {
      const entries = [
        {
          id: 1,
          start: "2026-01-13T08:00:00Z", // Valid yesterday entry
          end: "2026-01-13T09:00:00Z",
          tags: ["WORK"],
        },
        {
          id: 2,
          start: "2026-01-14T08:00:00Z", // Today entry - should be filtered
          end: "2026-01-14T09:00:00Z",
          tags: ["WORK"],
        },
        {
          id: 3,
          start: "2026-01-13T10:00:00Z", // Valid yesterday entry
          end: "2026-01-13T08:00:00Z", // Invalid: end before start
          tags: ["WORK"],
        },
        {
          id: 4,
          start: "invalid-date", // Invalid timestamp format
          end: "2026-01-13T09:00:00Z",
          tags: ["WORK"],
        },
        {
          id: 5,
          start: "2026-01-12T08:00:00Z", // Valid entry from day before yesterday
          end: "2026-01-12T09:00:00Z",
          tags: ["WORK"],
        },
      ];

      const result = validateEntries(entries);

      // Should return object with valid entries and validation errors
      expect(result.validEntries).toHaveLength(2); // Entries 1 and 5
      expect(result.validEntries.map((e) => e.id)).toEqual([1, 5]);

      expect(result.filteredCount).toBe(1); // Entry 2 filtered for being today
      expect(result.invalidCount).toBe(2); // Entries 3 and 4 invalid

      expect(result.errors).toHaveLength(3); // One for filtered today, two for invalid entries
    });

    it("should handle all valid entries", () => {
      const entries = [
        {
          id: 1,
          start: "2026-01-13T08:00:00Z",
          end: "2026-01-13T09:00:00Z",
          tags: ["WORK"],
        },
        {
          id: 2,
          start: "2026-01-12T08:00:00Z",
          end: "2026-01-12T09:00:00Z",
          tags: ["PERSONAL"],
        },
      ];

      const result = validateEntries(entries);

      expect(result.validEntries).toHaveLength(2);
      expect(result.filteredCount).toBe(0);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle empty input", () => {
      const result = validateEntries([]);

      expect(result.validEntries).toHaveLength(0);
      expect(result.filteredCount).toBe(0);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle null/undefined input", () => {
      expect(validateEntries(null).validEntries).toEqual([]);
      expect(validateEntries(undefined).validEntries).toEqual([]);
    });
  });
});
