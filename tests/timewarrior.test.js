import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  executeTimewExport,
  parseTimewOutput,
  exportTimewarriorData,
  validateTimewInstallation,
  buildTimewExportCommand,
  exportDateRange,
  exportSingleDate,
  exportAllData,
} from "../src/timewarrior/export.js";

// Mock child_process for command execution
vi.mock("child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

describe("Timewarrior Export Module", () => {
  let mockExec;
  let originalEnv;

  beforeEach(async () => {
    // Store original environment
    originalEnv = process.env;

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock exec from child_process
    const { exec } = await import("child_process");
    mockExec = exec;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Timewarrior Installation Validation", () => {
    it("should validate timewarrior installation in WSL", async () => {
      const mockCallback = vi.fn();
      mockExec.mockImplementation((command, callback) => {
        expect(command).toContain("wsl");
        expect(command).toContain("timew --version");
        callback(null, "timewarrior 1.4.3", "");
      });

      const result = await validateTimewInstallation();

      expect(result.isInstalled).toBe(true);
      expect(result.version).toContain("timewarrior");
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("wsl"),
        expect.any(Function)
      );
    });

    it("should detect missing timewarrior installation", async () => {
      mockExec.mockImplementation((command, callback) => {
        const error = new Error("command not found: timew");
        error.code = 127;
        callback(error, "", "command not found: timew");
      });

      const result = await validateTimewInstallation();

      expect(result.isInstalled).toBe(false);
      expect(result.error).toContain("command not found");
    });

    it("should handle WSL not available", async () => {
      mockExec.mockImplementation((command, callback) => {
        const error = new Error("wsl.exe not found");
        error.code = 2;
        callback(error, "", "wsl.exe not found");
      });

      const result = await validateTimewInstallation();

      expect(result.isInstalled).toBe(false);
      expect(result.error).toContain("wsl.exe not found");
    });

    it("should handle permission errors", async () => {
      mockExec.mockImplementation((command, callback) => {
        const error = new Error("Permission denied");
        error.code = 13;
        callback(error, "", "Permission denied");
      });

      const result = await validateTimewInstallation();

      expect(result.isInstalled).toBe(false);
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("Command Building", () => {
    it("should build basic timew export command for WSL", () => {
      const command = buildTimewExportCommand();

      expect(command).toContain("wsl");
      expect(command).toContain("timew export");
      expect(command).not.toContain("from");
      expect(command).not.toContain("to");
    });

    it("should build command with date range", () => {
      const startDate = "2024-01-01";
      const endDate = "2024-01-31";

      const command = buildTimewExportCommand(startDate, endDate);

      expect(command).toContain("wsl");
      expect(command).toContain("timew export");
      expect(command).toContain(startDate);
      expect(command).toContain(endDate);
    });

    it("should build command with single date", () => {
      const date = "2024-01-15";

      const command = buildTimewExportCommand(date);

      expect(command).toContain("wsl");
      expect(command).toContain("timew export");
      expect(command).toContain(date);
    });

    it("should handle special characters in dates", () => {
      const command = buildTimewExportCommand("2024-01-01", "2024-01-31");

      // Should properly escape or quote dates if needed
      expect(command).toBeTruthy();
      expect(command).toContain("2024-01-01");
      expect(command).toContain("2024-01-31");
    });

    it("should include proper timewarrior export format", () => {
      const command = buildTimewExportCommand();

      // Should export in JSON format
      expect(command).toContain("timew export");
    });
  });

  describe("Command Execution", () => {
    it("should execute timew export command successfully", async () => {
      const mockJsonOutput = JSON.stringify([
        {
          id: 1,
          start: "2024-01-01T10:00:00Z",
          end: "2024-01-01T11:00:00Z",
          annotation: "WORK-Meeting with team",
          tags: ["work"],
        },
      ]);

      mockExec.mockImplementation((command, callback) => {
        callback(null, mockJsonOutput, "");
      });

      const result = await executeTimewExport("timew export");

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockJsonOutput);
      expect(result.error).toBeUndefined();
    });

    it("should handle command execution errors", async () => {
      const errorMessage = "Failed to execute timew";
      mockExec.mockImplementation((command, callback) => {
        callback(new Error(errorMessage), "", "stderr output");
      });

      const result = await executeTimewExport("timew export");

      expect(result.success).toBe(false);
      expect(result.error).toContain(errorMessage);
      expect(result.data).toBeUndefined();
    });

    it("should handle timewarrior stderr warnings", async () => {
      const mockJsonOutput = JSON.stringify([]);
      const stderrWarning = "Warning: No data in range";

      mockExec.mockImplementation((command, callback) => {
        callback(null, mockJsonOutput, stderrWarning);
      });

      const result = await executeTimewExport("timew export");

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockJsonOutput);
      expect(result.warnings).toContain(stderrWarning);
    });

    it("should handle empty timewarrior output", async () => {
      mockExec.mockImplementation((command, callback) => {
        callback(null, "", "");
      });

      const result = await executeTimewExport("timew export");

      expect(result.success).toBe(true);
      expect(result.data).toBe("");
    });

    it("should timeout long-running commands", async () => {
      vi.useFakeTimers();

      mockExec.mockImplementation((command, callback) => {
        // Never call callback to simulate hanging command
      });

      const resultPromise = executeTimewExport("timew export", {
        timeout: 5000,
      });

      // Fast-forward time
      vi.advanceTimersByTime(6000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");

      vi.useRealTimers();
    });
  });

  describe("JSON Parsing", () => {
    it("should parse valid timewarrior JSON output", () => {
      const jsonOutput = JSON.stringify([
        {
          id: 1,
          start: "2024-01-01T10:00:00Z",
          end: "2024-01-01T11:00:00Z",
          annotation: "WORK-Meeting with team",
          tags: ["work"],
        },
        {
          id: 2,
          start: "2024-01-01T14:00:00Z",
          end: "2024-01-01T15:30:00Z",
          annotation: "LEARNING-Study JavaScript",
          tags: ["learning"],
        },
      ]);

      const result = parseTimewOutput(jsonOutput);

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe(1);
      expect(result.entries[0].annotation).toBe("WORK-Meeting with team");
      expect(result.entries[1].annotation).toBe("LEARNING-Study JavaScript");
    });

    it("should handle malformed JSON output", () => {
      const malformedJson = "{ invalid json content";

      const result = parseTimewOutput(malformedJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON");
      expect(result.entries).toBeUndefined();
    });

    it("should handle empty JSON array", () => {
      const emptyJson = "[]";

      const result = parseTimewOutput(emptyJson);

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(0);
    });

    it("should handle non-array JSON root", () => {
      const nonArrayJson = '{"message": "No data"}';

      const result = parseTimewOutput(nonArrayJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain("array");
    });

    it("should validate timewarrior entry structure", () => {
      const invalidStructureJson = JSON.stringify([
        {
          // Missing required fields like start time
          annotation: "Invalid entry",
        },
      ]);

      const result = parseTimewOutput(invalidStructureJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain("structure");
    });

    it("should handle entries without annotation", () => {
      const jsonWithoutAnnotation = JSON.stringify([
        {
          id: 1,
          start: "2024-01-01T10:00:00Z",
          end: "2024-01-01T11:00:00Z",
          tags: ["work"],
        },
      ]);

      const result = parseTimewOutput(jsonWithoutAnnotation);

      expect(result.success).toBe(true);
      expect(result.entries[0].annotation).toBeUndefined();
    });

    it("should handle entries with ongoing time tracking (no end time)", () => {
      const jsonWithOngoing = JSON.stringify([
        {
          id: 1,
          start: "2024-01-01T10:00:00Z",
          annotation: "WORK-Current task",
          tags: ["work"],
        },
      ]);

      const result = parseTimewOutput(jsonWithOngoing);

      expect(result.success).toBe(true);
      expect(result.entries[0].end).toBeUndefined();
    });
  });

  describe("High-Level Export Functions", () => {
    beforeEach(() => {
      // Mock successful command execution and parsing
      mockExec.mockImplementation((command, callback) => {
        const mockData = JSON.stringify([
          {
            id: 1,
            start: "2024-01-01T10:00:00Z",
            end: "2024-01-01T11:00:00Z",
            annotation: "WORK-Meeting",
            tags: ["work"],
          },
        ]);
        callback(null, mockData, "");
      });
    });

    describe("exportAllData", () => {
      it("should export all timewarrior data", async () => {
        const result = await exportAllData();

        expect(result.success).toBe(true);
        expect(result.entries).toBeDefined();
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining("timew export"),
          expect.any(Function)
        );
      });

      it("should handle export failure", async () => {
        mockExec.mockImplementation((command, callback) => {
          callback(new Error("Export failed"), "", "");
        });

        const result = await exportAllData();

        expect(result.success).toBe(false);
        expect(result.error).toContain("Export failed");
      });
    });

    describe("exportDateRange", () => {
      it("should export data for specific date range", async () => {
        const startDate = "2024-01-01";
        const endDate = "2024-01-31";

        const result = await exportDateRange(startDate, endDate);

        expect(result.success).toBe(true);
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`${startDate}.*${endDate}`)),
          expect.any(Function)
        );
      });

      it("should validate date range parameters", async () => {
        const result = await exportDateRange("invalid-date", "2024-01-31");

        expect(result.success).toBe(false);
        expect(result.error).toContain("date");
      });

      it("should handle start date after end date", async () => {
        const result = await exportDateRange("2024-01-31", "2024-01-01");

        expect(result.success).toBe(false);
        expect(result.error).toContain("start date");
      });
    });

    describe("exportSingleDate", () => {
      it("should export data for single date", async () => {
        const date = "2024-01-15";

        const result = await exportSingleDate(date);

        expect(result.success).toBe(true);
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining(date),
          expect.any(Function)
        );
      });

      it("should validate single date parameter", async () => {
        const result = await exportSingleDate("invalid-date");

        expect(result.success).toBe(false);
        expect(result.error).toContain("date");
      });

      it("should handle future dates", async () => {
        const futureDate = "2099-12-31";

        const result = await exportSingleDate(futureDate);

        expect(result.success).toBe(true);
        // Should still attempt export, timewarrior will handle empty results
      });
    });

    describe("exportTimewarriorData", () => {
      it("should be main entry point that combines validation and export", async () => {
        const options = {
          startDate: "2024-01-01",
          endDate: "2024-01-31",
          validateInstallation: true,
        };

        // Mock installation validation
        mockExec.mockImplementationOnce((command, callback) => {
          if (command.includes("--version")) {
            callback(null, "timewarrior 1.4.3", "");
          } else {
            callback(null, JSON.stringify([]), "");
          }
        });

        const result = await exportTimewarriorData(options);

        expect(result.success).toBe(true);
        expect(mockExec).toHaveBeenCalledTimes(2); // validation + export
      });

      it("should skip validation when requested", async () => {
        const options = {
          startDate: "2024-01-01",
          validateInstallation: false,
        };

        const result = await exportTimewarriorData(options);

        expect(result.success).toBe(true);
        expect(mockExec).toHaveBeenCalledTimes(1); // only export
      });

      it("should fail fast if installation validation fails", async () => {
        const options = {
          validateInstallation: true,
        };

        mockExec.mockImplementationOnce((command, callback) => {
          callback(new Error("timew not found"), "", "");
        });

        const result = await exportTimewarriorData(options);

        expect(result.success).toBe(false);
        expect(result.error).toContain("timew not found");
        expect(mockExec).toHaveBeenCalledTimes(1); // only validation
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle very large timewarrior output", async () => {
      // Simulate large dataset
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        start: `2024-01-01T${(i % 24).toString().padStart(2, "0")}:00:00Z`,
        end: `2024-01-01T${(i % 24).toString().padStart(2, "0")}:30:00Z`,
        annotation: `Task ${i}`,
        tags: ["work"],
      }));

      const largeJsonOutput = JSON.stringify(largeData);
      mockExec.mockImplementation((command, callback) => {
        callback(null, largeJsonOutput, "");
      });

      const result = await exportAllData();

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(10000);
    });

    it("should handle special characters in timewarrior data", async () => {
      const specialCharsData = JSON.stringify([
        {
          id: 1,
          start: "2024-01-01T10:00:00Z",
          end: "2024-01-01T11:00:00Z",
          annotation: 'WORK-Meeting with "special" chars & symbols 🎯',
          tags: ["work", "special-chars"],
        },
      ]);

      mockExec.mockImplementation((command, callback) => {
        callback(null, specialCharsData, "");
      });

      const result = await exportAllData();

      expect(result.success).toBe(true);
      expect(result.entries[0].annotation).toContain("🎯");
    });

    it("should handle network timeouts and retries", async () => {
      let callCount = 0;
      mockExec.mockImplementation((command, callback) => {
        callCount++;
        if (callCount === 1) {
          callback(new Error("Network timeout"), "", "");
        } else {
          callback(null, JSON.stringify([]), "");
        }
      });

      const options = { retries: 1 };
      const result = await exportTimewarriorData(options);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledTimes(2);
    });
  });
});
