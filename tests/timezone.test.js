import { describe, it, expect, beforeEach } from "vitest";
import {
  convertToTaipeiTime,
  convertEntriesToTaipeiTimezone,
  groupEntriesByTaipeiDate,
  calculateDateBoundaries,
  getTaipeiCalendarDate,
  isWithinDateBoundaries,
} from "../src/utils/timezone.js";

describe("Timezone Conversion Module", () => {
  describe("UTC to Taipei Time Conversion", () => {
    it("should convert UTC timestamp to Taipei timezone (UTC+8)", () => {
      const utcTime = "2024-01-15T10:00:00Z";
      const taipeiTime = convertToTaipeiTime(utcTime);

      expect(taipeiTime).toBe("2024-01-15T18:00:00+08:00");
    });

    it("should handle UTC time that crosses date boundary to next day in Taipei", () => {
      const utcTime = "2024-01-15T18:00:00Z"; // 6 PM UTC
      const taipeiTime = convertToTaipeiTime(utcTime);

      expect(taipeiTime).toBe("2024-01-16T02:00:00+08:00"); // 2 AM next day in Taipei
    });

    it("should handle UTC time in early morning that stays same date in Taipei", () => {
      const utcTime = "2024-01-15T00:30:00Z"; // 12:30 AM UTC
      const taipeiTime = convertToTaipeiTime(utcTime);

      expect(taipeiTime).toBe("2024-01-15T08:30:00+08:00"); // 8:30 AM same day in Taipei
    });

    it("should handle UTC time that crosses date boundary to previous day in Taipei", () => {
      const utcTime = "2024-01-15T05:00:00Z"; // 5 AM UTC
      const taipeiTime = convertToTaipeiTime(utcTime);

      expect(taipeiTime).toBe("2024-01-15T13:00:00+08:00"); // 1 PM same day in Taipei
    });

    it("should handle ISO timestamps without Z suffix", () => {
      const utcTime = "2024-01-15T10:00:00";
      const taipeiTime = convertToTaipeiTime(utcTime);

      expect(taipeiTime).toBe("2024-01-15T18:00:00+08:00");
    });

    it("should handle timestamps with milliseconds", () => {
      const utcTime = "2024-01-15T10:30:45.123Z";
      const taipeiTime = convertToTaipeiTime(utcTime);

      expect(taipeiTime).toBe("2024-01-15T18:30:45+08:00");
    });

    it("should throw error for invalid timestamp format", () => {
      expect(() => {
        convertToTaipeiTime("invalid-timestamp");
      }).toThrow("Invalid timestamp format");
    });

    it("should throw error for null or undefined timestamp", () => {
      expect(() => {
        convertToTaipeiTime(null);
      }).toThrow("Timestamp is required");

      expect(() => {
        convertToTaipeiTime(undefined);
      }).toThrow("Timestamp is required");
    });
  });

  describe("Get Taipei Calendar Date", () => {
    it("should extract YYYY-MM-DD date from Taipei timezone timestamp", () => {
      const taipeiTime = "2024-01-15T18:30:45+08:00";
      const calendarDate = getTaipeiCalendarDate(taipeiTime);

      expect(calendarDate).toBe("2024-01-15");
    });

    it("should handle early morning hours in Taipei", () => {
      const taipeiTime = "2024-01-15T01:30:00+08:00";
      const calendarDate = getTaipeiCalendarDate(taipeiTime);

      expect(calendarDate).toBe("2024-01-15");
    });

    it("should handle late night hours in Taipei", () => {
      const taipeiTime = "2024-01-15T23:59:59+08:00";
      const calendarDate = getTaipeiCalendarDate(taipeiTime);

      expect(calendarDate).toBe("2024-01-15");
    });

    it("should throw error for invalid Taipei timestamp", () => {
      expect(() => {
        getTaipeiCalendarDate("invalid-taipei-time");
      }).toThrow("Invalid Taipei timestamp format");
    });
  });

  describe("Convert Entries to Taipei Timezone", () => {
    let mockEntries;

    beforeEach(() => {
      mockEntries = [
        {
          id: 1,
          start: "2024-01-15T02:00:00Z",
          end: "2024-01-15T03:30:00Z",
          annotation: "WORK-Morning meeting",
          tags: ["work"],
        },
        {
          id: 2,
          start: "2024-01-15T14:00:00Z",
          end: "2024-01-15T16:00:00Z",
          annotation: "PERSONAL-Lunch break",
          tags: ["personal"],
        },
        {
          id: 3,
          start: "2024-01-15T20:00:00Z",
          // No end time (ongoing task)
          annotation: "WORK-Late night coding",
          tags: ["work"],
        },
      ];
    });

    it("should convert all entry timestamps to Taipei timezone", () => {
      const convertedEntries = convertEntriesToTaipeiTimezone(mockEntries);

      expect(convertedEntries).toHaveLength(3);

      // Entry 1: 2 AM UTC -> 10 AM Taipei
      expect(convertedEntries[0].start).toBe("2024-01-15T10:00:00+08:00");
      expect(convertedEntries[0].end).toBe("2024-01-15T11:30:00+08:00");

      // Entry 2: 2 PM UTC -> 10 PM Taipei
      expect(convertedEntries[1].start).toBe("2024-01-15T22:00:00+08:00");
      expect(convertedEntries[1].end).toBe("2024-01-16T00:00:00+08:00"); // Next day

      // Entry 3: 8 PM UTC -> 4 AM next day Taipei (ongoing)
      expect(convertedEntries[2].start).toBe("2024-01-16T04:00:00+08:00");
      expect(convertedEntries[2].end).toBeUndefined();
    });

    it("should preserve all original entry data except timestamps", () => {
      const convertedEntries = convertEntriesToTaipeiTimezone(mockEntries);

      expect(convertedEntries[0].id).toBe(1);
      expect(convertedEntries[0].annotation).toBe("WORK-Morning meeting");
      expect(convertedEntries[0].tags).toEqual(["work"]);

      expect(convertedEntries[2].annotation).toBe("WORK-Late night coding");
      expect(convertedEntries[2].tags).toEqual(["work"]);
    });

    it("should handle empty entries array", () => {
      const convertedEntries = convertEntriesToTaipeiTimezone([]);

      expect(convertedEntries).toEqual([]);
    });

    it("should handle entries with missing start time", () => {
      const entriesWithMissingStart = [
        {
          id: 1,
          // Missing start time
          end: "2024-01-15T03:30:00Z",
          annotation: "Invalid entry",
          tags: ["test"],
        },
      ];

      expect(() => {
        convertEntriesToTaipeiTimezone(entriesWithMissingStart);
      }).toThrow("Entry missing required start time");
    });

    it("should add taipeiCalendarDate field to each entry", () => {
      const convertedEntries = convertEntriesToTaipeiTimezone(mockEntries);

      expect(convertedEntries[0].taipeiCalendarDate).toBe("2024-01-15");
      expect(convertedEntries[1].taipeiCalendarDate).toBe("2024-01-15"); // Start time date
      expect(convertedEntries[2].taipeiCalendarDate).toBe("2024-01-16");
    });
  });

  describe("Group Entries by Taipei Date", () => {
    let mockConvertedEntries;

    beforeEach(() => {
      mockConvertedEntries = [
        {
          id: 1,
          start: "2024-01-15T10:00:00+08:00",
          end: "2024-01-15T11:30:00+08:00",
          taipeiCalendarDate: "2024-01-15",
          annotation: "WORK-Morning meeting",
          tags: ["work"],
        },
        {
          id: 2,
          start: "2024-01-15T22:00:00+08:00",
          end: "2024-01-16T00:00:00+08:00",
          taipeiCalendarDate: "2024-01-15",
          annotation: "PERSONAL-Late dinner",
          tags: ["personal"],
        },
        {
          id: 3,
          start: "2024-01-16T04:00:00+08:00",
          taipeiCalendarDate: "2024-01-16",
          annotation: "WORK-Early coding",
          tags: ["work"],
        },
        {
          id: 4,
          start: "2024-01-16T09:00:00+08:00",
          end: "2024-01-16T12:00:00+08:00",
          taipeiCalendarDate: "2024-01-16",
          annotation: "WORK-Client meeting",
          tags: ["work"],
        },
      ];
    });

    it("should group entries by Taipei calendar date", () => {
      const grouped = groupEntriesByTaipeiDate(mockConvertedEntries);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped["2024-01-15"]).toHaveLength(2);
      expect(grouped["2024-01-16"]).toHaveLength(2);
    });

    it("should maintain entry order within each date group", () => {
      const grouped = groupEntriesByTaipeiDate(mockConvertedEntries);

      const jan15Entries = grouped["2024-01-15"];
      expect(jan15Entries[0].id).toBe(1);
      expect(jan15Entries[1].id).toBe(2);

      const jan16Entries = grouped["2024-01-16"];
      expect(jan16Entries[0].id).toBe(3);
      expect(jan16Entries[1].id).toBe(4);
    });

    it("should sort date keys in chronological order", () => {
      // Add more dates to test sorting
      const entriesWithMoreDates = [
        ...mockConvertedEntries,
        {
          id: 5,
          start: "2024-01-14T10:00:00+08:00",
          taipeiCalendarDate: "2024-01-14",
          annotation: "WORK-Previous day",
          tags: ["work"],
        },
        {
          id: 6,
          start: "2024-01-17T10:00:00+08:00",
          taipeiCalendarDate: "2024-01-17",
          annotation: "WORK-Future day",
          tags: ["work"],
        },
      ];

      const grouped = groupEntriesByTaipeiDate(entriesWithMoreDates);
      const dateKeys = Object.keys(grouped);

      expect(dateKeys).toEqual([
        "2024-01-14",
        "2024-01-15",
        "2024-01-16",
        "2024-01-17",
      ]);
    });

    it("should handle empty entries array", () => {
      const grouped = groupEntriesByTaipeiDate([]);

      expect(grouped).toEqual({});
    });

    it("should handle entries without taipeiCalendarDate field", () => {
      const entriesWithoutDate = [
        {
          id: 1,
          start: "2024-01-15T10:00:00+08:00",
          annotation: "Missing date field",
        },
      ];

      expect(() => {
        groupEntriesByTaipeiDate(entriesWithoutDate);
      }).toThrow("Entry missing taipeiCalendarDate field");
    });

    it("should include metadata for each date group", () => {
      const grouped = groupEntriesByTaipeiDate(mockConvertedEntries);

      expect(grouped["2024-01-15"]).toHaveLength(2);
      expect(grouped["2024-01-16"]).toHaveLength(2);

      // Should have metadata about entry count
      const groupedWithMeta = groupEntriesByTaipeiDate(mockConvertedEntries, {
        includeMetadata: true,
      });
      expect(groupedWithMeta["2024-01-15"].metadata.entryCount).toBe(2);
      expect(groupedWithMeta["2024-01-16"].metadata.entryCount).toBe(2);
    });
  });

  describe("Calculate Date Boundaries", () => {
    it("should calculate UTC boundaries for a Taipei calendar date", () => {
      const taipeiDate = "2024-01-15";
      const boundaries = calculateDateBoundaries(taipeiDate);

      // Taipei 2024-01-15 00:00:00 = UTC 2024-01-14 16:00:00
      expect(boundaries.startUTC).toBe("2024-01-14T16:00:00Z");
      // Taipei 2024-01-15 23:59:59.999 = UTC 2024-01-15 15:59:59.999
      expect(boundaries.endUTC).toBe("2024-01-15T15:59:59.999Z");

      expect(boundaries.taipeiDate).toBe("2024-01-15");
      expect(boundaries.startTaipei).toBe("2024-01-15T00:00:00+08:00");
      expect(boundaries.endTaipei).toBe("2024-01-15T23:59:59+08:00");
    });

    it("should handle date boundaries for filtering timewarrior data", () => {
      const boundaries = calculateDateBoundaries("2024-06-15");

      // Summer time should still be UTC+8 for Taipei
      expect(boundaries.startUTC).toBe("2024-06-14T16:00:00Z");
      expect(boundaries.endUTC).toBe("2024-06-15T15:59:59.999Z");
    });

    it("should handle leap year date", () => {
      const boundaries = calculateDateBoundaries("2024-02-29");

      expect(boundaries.startUTC).toBe("2024-02-28T16:00:00Z");
      expect(boundaries.endUTC).toBe("2024-02-29T15:59:59.999Z");
      expect(boundaries.taipeiDate).toBe("2024-02-29");
    });

    it("should handle end of year date", () => {
      const boundaries = calculateDateBoundaries("2024-12-31");

      expect(boundaries.startUTC).toBe("2024-12-30T16:00:00Z");
      expect(boundaries.endUTC).toBe("2024-12-31T15:59:59.999Z");
    });

    it("should throw error for invalid date format", () => {
      expect(() => {
        calculateDateBoundaries("invalid-date");
      }).toThrow("Invalid date format. Expected YYYY-MM-DD");
    });

    it("should throw error for null or undefined date", () => {
      expect(() => {
        calculateDateBoundaries(null);
      }).toThrow("Date is required");

      expect(() => {
        calculateDateBoundaries(undefined);
      }).toThrow("Date is required");
    });
  });

  describe("Date Boundary Validation", () => {
    it("should check if UTC timestamp falls within Taipei date boundaries", () => {
      const boundaries = calculateDateBoundaries("2024-01-15");

      // UTC timestamps that fall within Taipei 2024-01-15
      expect(isWithinDateBoundaries("2024-01-14T18:00:00Z", boundaries)).toBe(
        true
      ); // 2 AM Taipei
      expect(isWithinDateBoundaries("2024-01-15T10:00:00Z", boundaries)).toBe(
        true
      ); // 6 PM Taipei
      expect(isWithinDateBoundaries("2024-01-15T15:30:00Z", boundaries)).toBe(
        true
      ); // 11:30 PM Taipei

      // UTC timestamps outside Taipei 2024-01-15
      expect(isWithinDateBoundaries("2024-01-14T15:30:00Z", boundaries)).toBe(
        false
      ); // Previous day
      expect(isWithinDateBoundaries("2024-01-15T16:30:00Z", boundaries)).toBe(
        false
      ); // Next day
    });

    it("should handle boundary edge cases", () => {
      const boundaries = calculateDateBoundaries("2024-01-15");

      // Exactly at start boundary (should be included)
      expect(isWithinDateBoundaries("2024-01-14T16:00:00Z", boundaries)).toBe(
        true
      );

      // Just before start boundary (should be excluded)
      expect(isWithinDateBoundaries("2024-01-14T15:59:59Z", boundaries)).toBe(
        false
      );

      // Just before end boundary (should be included)
      expect(isWithinDateBoundaries("2024-01-15T15:59:59Z", boundaries)).toBe(
        true
      );

      // Just after end boundary (should be excluded)
      expect(isWithinDateBoundaries("2024-01-15T16:00:00Z", boundaries)).toBe(
        false
      );
    });

    it("should handle timestamps with different formats", () => {
      const boundaries = calculateDateBoundaries("2024-01-15");

      // With milliseconds
      expect(
        isWithinDateBoundaries("2024-01-15T10:30:45.123Z", boundaries)
      ).toBe(true);

      // Without Z suffix (should be treated as UTC)
      expect(isWithinDateBoundaries("2024-01-15T10:30:45", boundaries)).toBe(
        true
      );
    });

    it("should throw error for invalid timestamp in boundary check", () => {
      const boundaries = calculateDateBoundaries("2024-01-15");

      expect(() => {
        isWithinDateBoundaries("invalid-timestamp", boundaries);
      }).toThrow("Invalid timestamp format");
    });
  });

  describe("Integration: Complete Timezone Workflow", () => {
    it("should convert, group, and filter entries for specific Taipei dates", () => {
      const rawEntries = [
        {
          id: 1,
          start: "2024-01-14T18:00:00Z", // 2 AM Jan 15 Taipei
          end: "2024-01-14T20:00:00Z", // 4 AM Jan 15 Taipei
          annotation: "WORK-Early task",
          tags: ["work"],
        },
        {
          id: 2,
          start: "2024-01-15T14:00:00Z", // 10 PM Jan 15 Taipei
          end: "2024-01-15T16:30:00Z", // 12:30 AM Jan 16 Taipei
          annotation: "PERSONAL-Late dinner",
          tags: ["personal"],
        },
      ];

      // Convert to Taipei timezone
      const convertedEntries = convertEntriesToTaipeiTimezone(rawEntries);

      // Group by Taipei date
      const groupedByDate = groupEntriesByTaipeiDate(convertedEntries);

      // Should have both entries in Jan 15 group (grouped by start time date)
      expect(groupedByDate["2024-01-15"]).toHaveLength(2);
      expect(groupedByDate["2024-01-16"]).toBeUndefined();

      // Calculate boundaries for filtering
      const jan15Boundaries = calculateDateBoundaries("2024-01-15");

      // Both original UTC times should be within Jan 15 Taipei boundaries
      expect(
        isWithinDateBoundaries("2024-01-14T18:00:00Z", jan15Boundaries)
      ).toBe(true);
      expect(
        isWithinDateBoundaries("2024-01-15T14:00:00Z", jan15Boundaries)
      ).toBe(true);
    });

    it("should handle cross-midnight entries spanning Taipei dates", () => {
      const crossMidnightEntry = {
        id: 1,
        start: "2024-01-15T15:30:00Z", // 11:30 PM Jan 15 Taipei
        end: "2024-01-15T17:30:00Z", // 1:30 AM Jan 16 Taipei
        annotation: "WORK-Overnight task",
        tags: ["work"],
      };

      const convertedEntries = convertEntriesToTaipeiTimezone([
        crossMidnightEntry,
      ]);

      // Should be grouped by start date (Jan 15)
      expect(convertedEntries[0].taipeiCalendarDate).toBe("2024-01-15");

      const boundaries = calculateDateBoundaries("2024-01-15");
      expect(isWithinDateBoundaries("2024-01-15T15:30:00Z", boundaries)).toBe(
        true
      );
    });
  });
});
