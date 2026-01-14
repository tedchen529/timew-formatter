/**
 * Annotation Parser Module
 *
 * Parses timewarrior annotations to extract project names and clean annotation text.
 * Project names must be CAPITALIZED LETTERS only and come before the first dash.
 */

/**
 * Validates if a string contains only uppercase letters
 * @param {string} name - The string to validate
 * @returns {boolean} - True if valid project name, false otherwise
 */
export function isValidProjectName(name) {
  if (name == null || typeof name !== "string") {
    return false;
  }

  const trimmed = name.trim();

  if (trimmed === "") {
    return false;
  }

  // Check if string contains only uppercase letters A-Z
  return /^[A-Z]+$/.test(trimmed);
}

/**
 * Cleans and trims annotation text
 * @param {string} text - The text to clean
 * @returns {string} - Cleaned text
 */
export function cleanAnnotationText(text) {
  if (text == null || typeof text !== "string") {
    return "";
  }

  return text.trim();
}

/**
 * Extracts project name from text before the first dash
 * @param {string} text - The text to extract from
 * @returns {string|null} - Project name if valid, null otherwise
 */
export function extractProjectName(text) {
  if (text == null || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  const dashIndex = trimmed.indexOf("-");

  let potentialProject;
  if (dashIndex === -1) {
    // No dash found, check entire text
    potentialProject = trimmed;
  } else {
    // Extract text before first dash
    potentialProject = trimmed.substring(0, dashIndex).trim();
  }

  return isValidProjectName(potentialProject) ? potentialProject : null;
}

/**
 * Parses annotation to extract project name and cleaned annotation
 * @param {string} annotation - The annotation to parse
 * @returns {object} - Object with projectName and annotation properties
 */
export function parseAnnotation(annotation) {
  if (annotation == null || typeof annotation !== "string") {
    return {
      projectName: "DEFAULT",
      annotation: "",
    };
  }

  const trimmed = annotation.trim();

  if (trimmed === "") {
    return {
      projectName: "DEFAULT",
      annotation: "",
    };
  }

  const dashIndex = trimmed.indexOf("-");

  if (dashIndex === -1) {
    // No dash found, check if entire text is valid project name
    if (isValidProjectName(trimmed)) {
      return {
        projectName: trimmed,
        annotation: trimmed,
      };
    } else {
      return {
        projectName: "DEFAULT",
        annotation: trimmed,
      };
    }
  }

  // Extract potential project name before first dash
  const potentialProject = trimmed.substring(0, dashIndex).trim();
  const annotationPart = trimmed.substring(dashIndex + 1);

  if (isValidProjectName(potentialProject)) {
    return {
      projectName: potentialProject,
      annotation: cleanAnnotationText(annotationPart),
    };
  } else {
    // Invalid project name, use DEFAULT and keep original annotation
    // Special case: if original was just whitespace around a single dash, return empty annotation
    if (/^\s*-\s*$/.test(annotation)) {
      return {
        projectName: "DEFAULT",
        annotation: "",
      };
    }
    return {
      projectName: "DEFAULT",
      annotation: trimmed,
    };
  }
}
