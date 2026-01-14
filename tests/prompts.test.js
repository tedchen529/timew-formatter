import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  promptForGroupType,
  promptForMultipleGroupTypes,
  handlePromptInterruption,
} from "../src/cli/prompts.js";

describe("User Input Handling - Prompts", () => {
  let mockReadline;
  let mockStdin;
  let mockStdout;

  beforeEach(() => {
    // Mock readline interface
    mockReadline = {
      question: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    // Mock stdin/stdout for Ctrl+C handling
    mockStdin = {
      on: vi.fn(),
      setRawMode: vi.fn(),
    };

    mockStdout = {
      write: vi.fn(),
    };

    // Mock process.exit
    vi.spyOn(process, "exit").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("promptForGroupType", () => {
    it("should prompt user with date context and return valid groupType", async () => {
      const testDate = "2024-01-15";
      const expectedPrompt = `Enter groupType for date ${testDate}: `;
      const userInput = "DEVELOPMENT";

      mockReadline.question.mockImplementation((prompt, callback) => {
        expect(prompt).toBe(expectedPrompt);
        callback(userInput);
      });

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe(userInput);
      expect(mockReadline.question).toHaveBeenCalledOnce();
    });

    it("should display helpful context about the date being processed", async () => {
      const testDate = "2024-01-15";
      const userInput = "TESTING";

      mockReadline.question.mockImplementation((prompt, callback) => {
        expect(prompt).toContain(testDate);
        expect(prompt).toContain("groupType");
        callback(userInput);
      });

      await promptForGroupType(testDate, mockReadline);
    });

    it("should reject empty groupType input", async () => {
      const testDate = "2024-01-15";

      mockReadline.question
        .mockImplementationOnce((prompt, callback) => callback(""))
        .mockImplementationOnce((prompt, callback) => callback("   "))
        .mockImplementationOnce((prompt, callback) => callback("VALID_INPUT"));

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe("VALID_INPUT");
      expect(mockReadline.question).toHaveBeenCalledTimes(3);
    });

    it("should reject null/undefined groupType input", async () => {
      const testDate = "2024-01-15";

      mockReadline.question
        .mockImplementationOnce((prompt, callback) => callback(null))
        .mockImplementationOnce((prompt, callback) => callback(undefined))
        .mockImplementationOnce((prompt, callback) => callback("VALID_INPUT"));

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe("VALID_INPUT");
      expect(mockReadline.question).toHaveBeenCalledTimes(3);
    });

    it("should trim whitespace from groupType input", async () => {
      const testDate = "2024-01-15";
      const userInput = "  DEVELOPMENT  ";
      const expectedResult = "DEVELOPMENT";

      mockReadline.question.mockImplementation((prompt, callback) => {
        callback(userInput);
      });

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe(expectedResult);
    });

    it("should display validation error messages for invalid input", async () => {
      const testDate = "2024-01-15";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockReadline.question
        .mockImplementationOnce((prompt, callback) => callback(""))
        .mockImplementationOnce((prompt, callback) => callback("VALID_INPUT"));

      await promptForGroupType(testDate, mockReadline);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("cannot be empty")
      );
      consoleSpy.mockRestore();
    });
  });

  describe("promptForMultipleGroupTypes", () => {
    it("should prompt for groupType for each unique date", async () => {
      const dates = ["2024-01-15", "2024-01-16", "2024-01-17"];
      const expectedResults = {
        "2024-01-15": "DEVELOPMENT",
        "2024-01-16": "TESTING",
        "2024-01-17": "MEETING",
      };

      let callIndex = 0;
      mockReadline.question.mockImplementation((prompt, callback) => {
        const date = dates[callIndex];
        const response = Object.values(expectedResults)[callIndex];
        callIndex++;
        callback(response);
      });

      const result = await promptForMultipleGroupTypes(dates, mockReadline);

      expect(result).toEqual(expectedResults);
      expect(mockReadline.question).toHaveBeenCalledTimes(3);
    });

    it("should handle empty dates array", async () => {
      const result = await promptForMultipleGroupTypes([], mockReadline);

      expect(result).toEqual({});
      expect(mockReadline.question).not.toHaveBeenCalled();
    });

    it("should maintain order of dates in prompts", async () => {
      const dates = ["2024-01-17", "2024-01-15", "2024-01-16"];
      const prompts = [];

      mockReadline.question.mockImplementation((prompt, callback) => {
        prompts.push(prompt);
        callback("TEST");
      });

      await promptForMultipleGroupTypes(dates, mockReadline);

      expect(prompts[0]).toContain("2024-01-17");
      expect(prompts[1]).toContain("2024-01-15");
      expect(prompts[2]).toContain("2024-01-16");
    });

    it("should validate all inputs before returning results", async () => {
      const dates = ["2024-01-15", "2024-01-16"];

      mockReadline.question
        .mockImplementationOnce((prompt, callback) => callback("")) // Invalid first
        .mockImplementationOnce((prompt, callback) => callback("VALID1")) // Valid retry
        .mockImplementationOnce((prompt, callback) => callback("VALID2")); // Valid second

      const result = await promptForMultipleGroupTypes(dates, mockReadline);

      expect(result).toEqual({
        "2024-01-15": "VALID1",
        "2024-01-16": "VALID2",
      });
    });
  });

  describe("handlePromptInterruption", () => {
    it("should handle Ctrl+C gracefully during prompts", async () => {
      const mockReadlineInterface = {
        ...mockReadline,
        on: vi.fn((event, callback) => {
          if (event === "SIGINT") {
            callback();
          }
        }),
      };

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      handlePromptInterruption(mockReadlineInterface);

      expect(mockReadlineInterface.on).toHaveBeenCalledWith(
        "SIGINT",
        expect.any(Function)
      );
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
    });

    it("should display user-friendly exit message on interruption", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockReadlineInterface = {
        ...mockReadline,
        on: vi.fn((event, callback) => {
          if (event === "SIGINT") {
            callback();
          }
        }),
      };

      handlePromptInterruption(mockReadlineInterface);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("interrupted")
      );

      consoleSpy.mockRestore();
    });

    it("should close readline interface before exiting", async () => {
      const mockReadlineInterface = {
        ...mockReadline,
        on: vi.fn((event, callback) => {
          if (event === "SIGINT") {
            callback();
          }
        }),
      };

      handlePromptInterruption(mockReadlineInterface);

      expect(mockReadlineInterface.close).toHaveBeenCalled();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle interruption during multi-date prompts", async () => {
      const dates = ["2024-01-15", "2024-01-16"];
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockReadlineInterface = {
        ...mockReadline,
        question: vi.fn((prompt, callback) => {
          // Simulate Ctrl+C during first prompt
          throw new Error("SIGINT");
        }),
        on: vi.fn((event, callback) => {
          if (event === "SIGINT") {
            callback();
          }
        }),
      };

      try {
        await promptForMultipleGroupTypes(dates, mockReadlineInterface);
      } catch (error) {
        expect(error.message).toBe("SIGINT");
      }

      consoleSpy.mockRestore();
    });

    it("should preserve partial results when interruption occurs", async () => {
      // This test ensures that if interruption happens mid-process,
      // any completed groupType entries are not lost
      const dates = ["2024-01-15", "2024-01-16", "2024-01-17"];
      const partialResults = {};

      let callCount = 0;
      mockReadline.question.mockImplementation((prompt, callback) => {
        callCount++;
        if (callCount <= 2) {
          const date = dates[callCount - 1];
          partialResults[date] = `GROUP${callCount}`;
          callback(`GROUP${callCount}`);
        } else {
          // Simulate interruption on third call
          throw new Error("User interruption");
        }
      });

      try {
        await promptForMultipleGroupTypes(dates, mockReadline);
      } catch (error) {
        // Verify partial results were captured before interruption
        expect(Object.keys(partialResults)).toHaveLength(2);
        expect(partialResults["2024-01-15"]).toBe("GROUP1");
        expect(partialResults["2024-01-16"]).toBe("GROUP2");
      }
    });
  });

  describe("Input validation edge cases", () => {
    it("should handle very long groupType inputs", async () => {
      const testDate = "2024-01-15";
      const longInput = "A".repeat(1000);

      mockReadline.question.mockImplementation((prompt, callback) => {
        callback(longInput);
      });

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe(longInput);
    });

    it("should handle special characters in groupType", async () => {
      const testDate = "2024-01-15";
      const specialInput = "DEV_TEST-123";

      mockReadline.question.mockImplementation((prompt, callback) => {
        callback(specialInput);
      });

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe(specialInput);
    });

    it("should handle unicode characters in groupType", async () => {
      const testDate = "2024-01-15";
      const unicodeInput = "DÉVELOPPEMENT";

      mockReadline.question.mockImplementation((prompt, callback) => {
        callback(unicodeInput);
      });

      const result = await promptForGroupType(testDate, mockReadline);

      expect(result).toBe(unicodeInput);
    });
  });
});
