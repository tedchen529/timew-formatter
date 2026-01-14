import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import { createCommand, parseArgs } from "../src/cli/commands.js";

// Mock child_process for testing CLI execution
vi.mock("child_process");

// Mock the modules that will be used by CLI commands
vi.mock("../src/timewarrior/export.js", () => ({
  exportTimeEntries: vi.fn(),
}));

vi.mock("../src/workflows/initial.js", () => ({
  runInitialSetup: vi.fn(),
}));

vi.mock("../src/workflows/incremental.js", () => ({
  runIncrementalUpdate: vi.fn(),
}));

vi.mock("../src/utils/validation.js", () => ({
  validateDateRange: vi.fn(),
  isValidDate: vi.fn(),
}));

describe("CLI Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    process.env.START_DATE = "2024-01-01";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Command Creation and Structure", () => {
    it("should create a commander program with proper configuration", () => {
      const program = createCommand();

      expect(program).toBeDefined();
      expect(program.name()).toBe("timew-formatter");
      expect(program.description()).toContain(
        "CLI tool to bridge Timewarrior data"
      );
      expect(program.version()).toMatch(/\d+\.\d+\.\d+/);
    });

    it("should have all required commands registered", () => {
      const program = createCommand();
      const commands = program.commands;

      const commandNames = commands.map((cmd) => cmd.name());
      expect(commandNames).toContain("fetch");
      expect(commands.length).toBeGreaterThanOrEqual(1);
    });

    it("should have proper help text and usage examples", () => {
      const program = createCommand();
      const helpText = program.helpInformation();

      expect(helpText).toContain("fetch");
      expect(helpText).toContain("all");
      expect(helpText).toContain("YYYY-MM-DD");
      expect(helpText).toContain("Examples:");
    });
  });

  describe("fetch all command", () => {
    it("should register fetch command with 'all' subcommand", () => {
      const program = createCommand();
      const fetchCommand = program.commands.find(
        (cmd) => cmd.name() === "fetch"
      );

      expect(fetchCommand).toBeDefined();
      expect(fetchCommand.description()).toContain(
        "Fetch time entries from Timewarrior"
      );
    });

    it("should handle 'fetch all' command execution", async () => {
      const mockRunInitialSetup = vi.fn().mockResolvedValue(true);
      const { runInitialSetup } = await import("../src/workflows/initial.js");
      runInitialSetup.mockImplementation(mockRunInitialSetup);

      const program = createCommand();
      const args = ["node", "timew-formatter", "fetch", "all"];

      await program.parseAsync(args);

      expect(mockRunInitialSetup).toHaveBeenCalledWith({
        startDate: "2024-01-01",
        endDate: expect.stringMatching(/\d{4}-\d{2}-\d{2}/), // yesterday's date
      });
    });

    it("should calculate yesterday's date correctly for 'fetch all'", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDate = yesterday.toISOString().split("T")[0];

      const program = createCommand();
      const args = parseArgs(["fetch", "all"]);

      expect(args.endDate).toBe(expectedDate);
      expect(args.startDate).toBe(process.env.START_DATE);
    });

    it("should fail gracefully if START_DATE environment variable is missing", () => {
      delete process.env.START_DATE;

      expect(() => {
        const program = createCommand();
        parseArgs(["fetch", "all"]);
      }).toThrow("START_DATE environment variable is required");
    });
  });

  describe("fetch single date command", () => {
    it("should handle 'fetch YYYY-MM-DD' command format", async () => {
      const mockRunIncrementalUpdate = vi.fn().mockResolvedValue(true);
      const { runIncrementalUpdate } = await import(
        "../src/workflows/incremental.js"
      );
      runIncrementalUpdate.mockImplementation(mockRunIncrementalUpdate);

      const testDate = "2024-03-15";
      const program = createCommand();
      const args = ["node", "timew-formatter", "fetch", testDate];

      await program.parseAsync(args);

      expect(mockRunIncrementalUpdate).toHaveBeenCalledWith({
        startDate: testDate,
        endDate: testDate,
      });
    });

    it("should validate single date format", () => {
      const validDate = "2024-03-15";
      const invalidDates = [
        "2024/03/15",
        "15-03-2024",
        "2024-3-15",
        "2024-13-01",
        "2024-02-30",
        "not-a-date",
      ];

      const args = parseArgs(["fetch", validDate]);
      expect(args.startDate).toBe(validDate);
      expect(args.endDate).toBe(validDate);

      invalidDates.forEach((invalidDate) => {
        expect(() => {
          parseArgs(["fetch", invalidDate]);
        }).toThrow(`Invalid date format: ${invalidDate}`);
      });
    });

    it("should reject future dates", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split("T")[0];

      expect(() => {
        parseArgs(["fetch", futureDate]);
      }).toThrow("Cannot fetch data from future dates");
    });
  });

  describe("fetch date range command", () => {
    it("should handle 'fetch YYYY-MM-DD YYYY-MM-DD' command format", async () => {
      const mockRunIncrementalUpdate = vi.fn().mockResolvedValue(true);
      const { runIncrementalUpdate } = await import(
        "../src/workflows/incremental.js"
      );
      runIncrementalUpdate.mockImplementation(mockRunIncrementalUpdate);

      const startDate = "2024-03-01";
      const endDate = "2024-03-15";
      const program = createCommand();
      const args = ["node", "timew-formatter", "fetch", startDate, endDate];

      await program.parseAsync(args);

      expect(mockRunIncrementalUpdate).toHaveBeenCalledWith({
        startDate,
        endDate,
      });
    });

    it("should validate date range order", () => {
      const earlierDate = "2024-03-01";
      const laterDate = "2024-03-15";

      // Valid range
      const validArgs = parseArgs(["fetch", earlierDate, laterDate]);
      expect(validArgs.startDate).toBe(earlierDate);
      expect(validArgs.endDate).toBe(laterDate);

      // Invalid range (end before start)
      expect(() => {
        parseArgs(["fetch", laterDate, earlierDate]);
      }).toThrow("End date must be after start date");
    });

    it("should validate both dates in range format", () => {
      const validDate = "2024-03-15";
      const invalidDate = "invalid-date";

      expect(() => {
        parseArgs(["fetch", validDate, invalidDate]);
      }).toThrow(`Invalid date format: ${invalidDate}`);

      expect(() => {
        parseArgs(["fetch", invalidDate, validDate]);
      }).toThrow(`Invalid date format: ${invalidDate}`);
    });

    it("should reject date ranges extending into the future", () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const validDate = "2024-03-01";
      const futureDate = tomorrow.toISOString().split("T")[0];

      expect(() => {
        parseArgs(["fetch", validDate, futureDate]);
      }).toThrow("Cannot fetch data from future dates");
    });
  });

  describe("Command Help and Usage", () => {
    it("should display help when --help flag is used", () => {
      const program = createCommand();
      const helpSpy = vi.spyOn(program, "outputHelp");

      try {
        program.parse(["node", "timew-formatter", "--help"]);
      } catch (error) {
        // Help command throws SystemExit, this is expected
      }

      expect(helpSpy).toHaveBeenCalled();
    });

    it("should include usage examples in help text", () => {
      const program = createCommand();
      const helpText = program.helpInformation();

      expect(helpText).toContain("Examples:");
      expect(helpText).toContain("timew-formatter fetch all");
      expect(helpText).toContain("timew-formatter fetch 2024-03-15");
      expect(helpText).toContain("timew-formatter fetch 2024-03-01 2024-03-15");
    });

    it("should show command description and options", () => {
      const program = createCommand();
      const fetchCommand = program.commands.find(
        (cmd) => cmd.name() === "fetch"
      );

      expect(fetchCommand.description()).toContain(
        "Fetch time entries from Timewarrior"
      );
      expect(fetchCommand.usage()).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid command arguments", () => {
      expect(() => {
        parseArgs(["fetch"]);
      }).toThrow("Missing required arguments for fetch command");
    });

    it("should handle too many arguments", () => {
      expect(() => {
        parseArgs(["fetch", "2024-03-01", "2024-03-15", "extra-arg"]);
      }).toThrow("Too many arguments for fetch command");
    });

    it("should provide helpful error messages for common mistakes", () => {
      const commonMistakes = [
        { args: ["fetch", "2024/03/15"], error: "Invalid date format" },
        { args: ["fetch", "15-03-2024"], error: "Invalid date format" },
        { args: ["fetch", "2024-3-1"], error: "Invalid date format" },
      ];

      commonMistakes.forEach(({ args, error }) => {
        expect(() => {
          parseArgs(args);
        }).toThrow(error);
      });
    });
  });

  describe("Integration with Workflow Modules", () => {
    it("should call initial workflow for 'fetch all' command", async () => {
      const mockRunInitialSetup = vi.fn().mockResolvedValue(true);
      const { runInitialSetup } = await import("../src/workflows/initial.js");
      runInitialSetup.mockImplementation(mockRunInitialSetup);

      const program = createCommand();
      await program.parseAsync(["node", "timew-formatter", "fetch", "all"]);

      expect(mockRunInitialSetup).toHaveBeenCalledTimes(1);
    });

    it("should call incremental workflow for date-specific commands", async () => {
      const mockRunIncrementalUpdate = vi.fn().mockResolvedValue(true);
      const { runIncrementalUpdate } = await import(
        "../src/workflows/incremental.js"
      );
      runIncrementalUpdate.mockImplementation(mockRunIncrementalUpdate);

      const program = createCommand();

      // Test single date
      await program.parseAsync([
        "node",
        "timew-formatter",
        "fetch",
        "2024-03-15",
      ]);
      expect(mockRunIncrementalUpdate).toHaveBeenCalledTimes(1);

      // Test date range
      await program.parseAsync([
        "node",
        "timew-formatter",
        "fetch",
        "2024-03-01",
        "2024-03-15",
      ]);
      expect(mockRunIncrementalUpdate).toHaveBeenCalledTimes(2);
    });

    it("should handle workflow errors gracefully", async () => {
      const mockRunInitialSetup = vi
        .fn()
        .mockRejectedValue(new Error("Workflow failed"));
      const { runInitialSetup } = await import("../src/workflows/initial.js");
      runInitialSetup.mockImplementation(mockRunInitialSetup);

      const program = createCommand();

      await expect(
        program.parseAsync(["node", "timew-formatter", "fetch", "all"])
      ).rejects.toThrow("Workflow failed");
    });
  });
});
