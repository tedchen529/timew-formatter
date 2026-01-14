import { describe, it, expect, beforeEach } from "vitest";
import {
  parseAnnotation,
  extractProjectName,
  isValidProjectName,
  cleanAnnotationText,
} from "../src/parsers/annotation.js";

describe("Annotation Parser", () => {
  describe("parseAnnotation", () => {
    it("should parse valid project with annotation", () => {
      const result = parseAnnotation("LEARNING-Learning Java");
      expect(result).toEqual({
        projectName: "LEARNING",
        annotation: "Learning Java",
      });
    });

    it("should parse valid project with empty annotation", () => {
      const result = parseAnnotation("WORK-");
      expect(result).toEqual({
        projectName: "WORK",
        annotation: "",
      });
    });

    it("should parse valid project with no dash", () => {
      const result = parseAnnotation("MEETING");
      expect(result).toEqual({
        projectName: "MEETING",
        annotation: "MEETING",
      });
    });

    it("should fallback to DEFAULT for invalid project name before dash", () => {
      const result = parseAnnotation("learning-Java session");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "learning-Java session",
      });
    });

    it("should fallback to DEFAULT for mixed case project name", () => {
      const result = parseAnnotation("Work-Daily meeting");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "Work-Daily meeting",
      });
    });

    it("should fallback to DEFAULT for project name with numbers", () => {
      const result = parseAnnotation("PROJECT1-Testing");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "PROJECT1-Testing",
      });
    });

    it("should fallback to DEFAULT for project name with spaces", () => {
      const result = parseAnnotation("MY PROJECT-Important task");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "MY PROJECT-Important task",
      });
    });

    it("should fallback to DEFAULT for empty project name before dash", () => {
      const result = parseAnnotation("-Some annotation");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "-Some annotation",
      });
    });

    it("should handle multiple dashes correctly", () => {
      const result = parseAnnotation("CODE-Fix bug - urgent priority");
      expect(result).toEqual({
        projectName: "CODE",
        annotation: "Fix bug - urgent priority",
      });
    });

    it("should handle annotation with only dashes", () => {
      const result = parseAnnotation("---");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "---",
      });
    });

    it("should handle empty string", () => {
      const result = parseAnnotation("");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "",
      });
    });

    it("should handle null input", () => {
      const result = parseAnnotation(null);
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "",
      });
    });

    it("should handle undefined input", () => {
      const result = parseAnnotation(undefined);
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "",
      });
    });

    it("should trim whitespace from project and annotation", () => {
      const result = parseAnnotation("  CLEANUP  -  Organizing files  ");
      expect(result).toEqual({
        projectName: "CLEANUP",
        annotation: "Organizing files",
      });
    });

    it("should handle single letter project", () => {
      const result = parseAnnotation("A-Single letter project");
      expect(result).toEqual({
        projectName: "A",
        annotation: "Single letter project",
      });
    });

    it("should handle very long project name", () => {
      const longProjectName = "VERYLONGPROJECTNAMEWITHLOTSOFDIFFERENTLETTERS";
      const result = parseAnnotation(`${longProjectName}-Description`);
      expect(result).toEqual({
        projectName: longProjectName,
        annotation: "Description",
      });
    });
  });

  describe("extractProjectName", () => {
    it("should extract valid project name before first dash", () => {
      expect(extractProjectName("WORK-Daily standup")).toBe("WORK");
    });

    it("should extract project name with multiple capital letters", () => {
      expect(extractProjectName("DEVELOPMENT-Code review")).toBe("DEVELOPMENT");
    });

    it("should return null for invalid project name", () => {
      expect(extractProjectName("work-meeting")).toBe(null);
    });

    it("should return null for mixed case", () => {
      expect(extractProjectName("Work-Meeting")).toBe(null);
    });

    it("should return null for numbers in project name", () => {
      expect(extractProjectName("WORK2-Task")).toBe(null);
    });

    it("should return null for special characters", () => {
      expect(extractProjectName("WORK_PROJECT-Task")).toBe(null);
    });

    it("should handle no dash case", () => {
      expect(extractProjectName("MEETING")).toBe("MEETING");
    });

    it("should return null for no dash with invalid name", () => {
      expect(extractProjectName("meeting")).toBe(null);
    });

    it("should handle empty string before dash", () => {
      expect(extractProjectName("-annotation")).toBe(null);
    });

    it("should trim whitespace", () => {
      expect(extractProjectName("  WORK  -task")).toBe("WORK");
    });
  });

  describe("isValidProjectName", () => {
    it("should validate all uppercase letters", () => {
      expect(isValidProjectName("WORK")).toBe(true);
      expect(isValidProjectName("PROJECT")).toBe(true);
      expect(isValidProjectName("A")).toBe(true);
    });

    it("should reject lowercase letters", () => {
      expect(isValidProjectName("work")).toBe(false);
      expect(isValidProjectName("Work")).toBe(false);
      expect(isValidProjectName("WOrk")).toBe(false);
    });

    it("should reject numbers", () => {
      expect(isValidProjectName("WORK1")).toBe(false);
      expect(isValidProjectName("2WORK")).toBe(false);
      expect(isValidProjectName("WO2RK")).toBe(false);
    });

    it("should reject special characters", () => {
      expect(isValidProjectName("WORK_PROJECT")).toBe(false);
      expect(isValidProjectName("WORK-PROJECT")).toBe(false);
      expect(isValidProjectName("WORK PROJECT")).toBe(false);
      expect(isValidProjectName("WORK.PROJECT")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidProjectName("")).toBe(false);
    });

    it("should reject null and undefined", () => {
      expect(isValidProjectName(null)).toBe(false);
      expect(isValidProjectName(undefined)).toBe(false);
    });

    it("should handle whitespace-only strings", () => {
      expect(isValidProjectName("   ")).toBe(false);
    });
  });

  describe("cleanAnnotationText", () => {
    it("should trim whitespace from annotation", () => {
      expect(cleanAnnotationText("  Clean me up  ")).toBe("Clean me up");
    });

    it("should handle empty string", () => {
      expect(cleanAnnotationText("")).toBe("");
    });

    it("should handle null", () => {
      expect(cleanAnnotationText(null)).toBe("");
    });

    it("should handle undefined", () => {
      expect(cleanAnnotationText(undefined)).toBe("");
    });

    it("should preserve internal spaces", () => {
      expect(cleanAnnotationText("Multiple   spaces   inside")).toBe(
        "Multiple   spaces   inside"
      );
    });

    it("should handle annotation with newlines", () => {
      expect(cleanAnnotationText("Line one\nLine two")).toBe(
        "Line one\nLine two"
      );
    });

    it("should handle annotation with tabs", () => {
      expect(cleanAnnotationText("\tTabbed content\t")).toBe("Tabbed content");
    });

    it("should handle very long annotations", () => {
      const longText =
        "This is a very long annotation text that might come from timewarrior entries and should be handled properly by the cleaning function";
      expect(cleanAnnotationText(`  ${longText}  `)).toBe(longText);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle annotation with only whitespace and dashes", () => {
      const result = parseAnnotation("   -   ");
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: "",
      });
    });

    it("should handle unicode characters in annotation", () => {
      const result = parseAnnotation("WORK-Meeting with café ☕");
      expect(result).toEqual({
        projectName: "WORK",
        annotation: "Meeting with café ☕",
      });
    });

    it("should handle very long invalid project name", () => {
      const longInvalidName =
        "thisIsAVeryLongProjectNameThatShouldNotBeValidBecauseItContainsLowercaseLetters";
      const result = parseAnnotation(`${longInvalidName}-Description`);
      expect(result).toEqual({
        projectName: "DEFAULT",
        annotation: `${longInvalidName}-Description`,
      });
    });

    it("should handle annotation starting with dash", () => {
      const result = parseAnnotation("WORK--Starting with dash");
      expect(result).toEqual({
        projectName: "WORK",
        annotation: "-Starting with dash",
      });
    });

    it("should handle annotation ending with dash", () => {
      const result = parseAnnotation("WORK-Ending with dash-");
      expect(result).toEqual({
        projectName: "WORK",
        annotation: "Ending with dash-",
      });
    });
  });

  describe("Real-world Examples", () => {
    it("should handle common coding project annotations", () => {
      expect(
        parseAnnotation("CODING-Implementing user authentication")
      ).toEqual({
        projectName: "CODING",
        annotation: "Implementing user authentication",
      });
    });

    it("should handle meeting annotations", () => {
      expect(parseAnnotation("MEETINGS-Weekly team standup")).toEqual({
        projectName: "MEETINGS",
        annotation: "Weekly team standup",
      });
    });

    it("should handle learning annotations", () => {
      expect(
        parseAnnotation("LEARNING-Reading documentation for new framework")
      ).toEqual({
        projectName: "LEARNING",
        annotation: "Reading documentation for new framework",
      });
    });

    it("should handle break annotations", () => {
      expect(parseAnnotation("BREAK-Lunch break")).toEqual({
        projectName: "BREAK",
        annotation: "Lunch break",
      });
    });

    it("should fallback for informal annotations", () => {
      expect(parseAnnotation("quick coffee break")).toEqual({
        projectName: "DEFAULT",
        annotation: "quick coffee break",
      });
    });

    it("should fallback for mixed case project names", () => {
      expect(parseAnnotation("Coding-Fix bug in payment module")).toEqual({
        projectName: "DEFAULT",
        annotation: "Coding-Fix bug in payment module",
      });
    });
  });
});
